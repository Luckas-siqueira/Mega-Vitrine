import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

spec = importlib.util.spec_from_file_location('importer', Path(__file__).parents[1] / 'scripts/importar_shopee.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ImportTests(unittest.TestCase):
    def test_link_ids_and_rejected_origins(self):
        for url in ['https://shopee.com.br/product/123/456', 'https://shopee.com.br/Produto-i.123.456', 'https://shopee.com.br/opaanlp/123/456?utm_source=affiliate']:
            self.assertEqual(m.resolve_product(url), ('123', '456'))
        for url in ['http://shopee.com.br/product/1/2', 'https://shopee.com.br.evil.test/product/1/2', 'https://127.0.0.1/', 'https://user:pass@shopee.com.br/product/1/2', 'https://shopee.com.br:8080/product/1/2']:
            with self.assertRaises(m.ImportErrorPublic): m.safe_url(url)

    def test_short_redirect_stops_at_identified_product(self):
        import urllib.error
        error = urllib.error.HTTPError('https://s.shopee.com.br/example', 301, '', {'Location': 'https://shopee.com.br/opaanlp/123/456?tracking=1'}, None)
        with patch.object(m.urllib.request, 'build_opener') as factory:
            factory.return_value.open.side_effect = error
            self.assertEqual(m.resolve_product('https://s.shopee.com.br/example'), ('123', '456'))
            self.assertEqual(factory.return_value.open.call_count, 1)
        error.headers['Location'] = 'https://127.0.0.1/private'
        with patch.object(m.urllib.request, 'build_opener') as factory:
            factory.return_value.open.side_effect = error
            with self.assertRaises(m.ImportErrorPublic): m.resolve_product('https://s.shopee.com.br/example')

    def test_signature_and_matching_offer(self):
        response = {'data': {'productOfferV2': {'nodes': [{'itemId': 456, 'shopId': 123}]}}}
        with patch.object(m.time, 'time', return_value=1000), patch.object(m.urllib.request, 'urlopen') as request:
            request.return_value.__enter__.return_value.read.return_value = json.dumps(response).encode()
            m.request_offer('123', '456', 'app', 'secret')
            req = request.call_args.args[0]
            signature = hashlib.sha256(b'app1000' + req.data + b'secret').hexdigest()
            self.assertEqual(req.get_header('Authorization'), 'SHA256 Credential=app, Timestamp=1000, Signature=' + signature)
            response['data']['productOfferV2']['nodes'][0]['itemId'] = 999
            request.return_value.__enter__.return_value.read.return_value = json.dumps(response).encode()
            with self.assertRaises(m.ImportErrorPublic): m.request_offer('123', '456', 'app', 'secret')

    def test_missing_credentials(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(m, 'resolve_product') as resolve:
            with self.assertRaisesRegex(m.ImportErrorPublic, 'SHOPEE_APP_ID'):
                m.import_product('https://s.shopee.com.br/example', '', '', Path(folder))
            resolve.assert_not_called()

    def test_optimized_images_and_catalog_unchanged(self):
        raw = io.BytesIO();Image.new('RGB', (1600, 1000), '#aacc22').save(raw, 'PNG')
        offer = {'productName': 'Tênis Fitness', 'shopId': 123, 'itemId': 456, 'offerLink': 'https://s.shopee.com.br/own-affiliate', 'imageUrl': 'https://down-br.img.susercontent.com/test', 'priceMin': '29.90', 'priceMax': '39.90'}
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder);catalog = root / 'produtos.json';catalog.write_text('[{"id":"existing"}]')
            with patch.object(m, 'resolve_product', return_value=('123','456')), patch.object(m, 'request_offer', return_value=offer), patch.object(m, 'download_image', return_value=raw.getvalue()):
                result = m.import_product('https://s.shopee.com.br/other-affiliate', 'app', 'secret', root)
                m.import_product('https://s.shopee.com.br/other-affiliate', 'app', 'secret', root)
            self.assertEqual(catalog.read_text(), '[{"id":"existing"}]')
            self.assertEqual(result['product']['url'], offer['offerLink'])
            self.assertEqual(result['product']['preco'], 29.9)
            self.assertEqual(result['product']['descricao'], '')
            self.assertFalse(result['product']['destaque'])
            for folder_name, size in [('produtos',480), ('ampliadas',1200)]:
                files = list((root/'imagens'/folder_name).glob('*.webp'));self.assertEqual(len(files),1)
                with Image.open(files[0]) as image:
                    self.assertEqual(image.format,'WEBP');self.assertEqual(max(image.size),size)
            self.assertEqual(next((root/'imagens/originais').glob('*')).read_bytes(), raw.getvalue())

    def test_small_images_are_not_enlarged(self):
        data = io.BytesIO();Image.new('RGBA',(100,80),(0,0,0,0)).save(data,'PNG')
        ext, versions = m.image_versions(data.getvalue())
        self.assertEqual(ext,'png')
        for version in versions:
            with Image.open(io.BytesIO(version)) as image:self.assertEqual(image.size,(100,80))

if __name__ == '__main__': unittest.main()
