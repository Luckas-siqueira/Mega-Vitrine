"""Importação pela API oficial. Nunca altera o catálogo; produz um rascunho."""
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from PIL import Image, ImageOps

API = 'https://open-api.affiliate.shopee.com.br/graphql'
SHOPEE_HOSTS = {'shopee.com.br', 'www.shopee.com.br', 's.shopee.com.br', 'shope.ee'}
Image.MAX_IMAGE_PIXELS = 25_000_000

class ImportErrorPublic(Exception):
    pass

def safe_url(url, image=False):
    p = urllib.parse.urlsplit(url)
    host = (p.hostname or '').lower()
    allowed = (host == 'down-br.img.susercontent.com' or host.endswith('.susercontent.com') or host.endswith('.shopee.com.br') or host.endswith('.shopee.com')) if image else host in SHOPEE_HOSTS
    if p.scheme != 'https' or p.username or p.password or p.port not in (None, 443) or not allowed:
        raise ImportErrorPublic('Use um link HTTPS de produto da Shopee. A imagem deve vir da Shopee.')
    return url

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None

def product_ids(url):
    p = urllib.parse.urlsplit(url)
    m = re.search(r'/(?:product|opaanlp)/(\d+)/(\d+)(?:/|$)', p.path)
    if not m:
        m = re.search(r'-i\.(\d+)\.(\d+)(?:/|$)', p.path)
    return m.groups() if m else None

def resolve_product(url):
    current = safe_url(url)
    opener = urllib.request.build_opener(NoRedirect)
    for _ in range(6):
        ids = product_ids(current)
        if ids:
            return ids
        try:
            with opener.open(urllib.request.Request(current, headers={'User-Agent': 'MegaVitrine/1.0'}), timeout=20):
                break
        except urllib.error.HTTPError as e:
            if e.code not in (301, 302, 303, 307, 308) or not e.headers.get('Location'):
                raise ImportErrorPublic('Não foi possível abrir esse link. Tente o link completo do produto na Shopee.') from None
            current = safe_url(urllib.parse.urljoin(current, e.headers['Location']))
    raise ImportErrorPublic('Não foi possível identificar o produto. Use o link completo da página do produto na Shopee.')

def request_offer(shop_id, item_id, app_id, secret):
    query = f'{{productOfferV2(shopId:{int(shop_id)},itemId:{int(item_id)},limit:1){{nodes{{itemId shopId productName imageUrl priceMin priceMax price productLink offerLink}}}}}}'
    payload = json.dumps({'query': query}, separators=(',', ':'), ensure_ascii=False)
    timestamp = str(math.ceil(time.time()))
    signature = hashlib.sha256((app_id + timestamp + payload + secret).encode()).hexdigest()
    req = urllib.request.Request(API, data=payload.encode(), headers={
        'Content-Type': 'application/json',
        'Authorization': f'SHA256 Credential={app_id}, Timestamp={timestamp}, Signature={signature}',
    })
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read(2_000_000))
    if data.get('errors'):
        raise ImportErrorPublic('A API da Shopee recusou a consulta. Confira as credenciais e a aprovação do acesso à Open API.')
    nodes = (data.get('data') or {}).get('productOfferV2', {}).get('nodes', [])
    if not nodes:
        raise ImportErrorPublic('A API não retornou uma oferta para esse produto. Ele pode estar indisponível ou fora do catálogo de afiliados.')
    offer = nodes[0]
    if str(offer.get('itemId')) != str(item_id) or str(offer.get('shopId')) != str(shop_id):
        raise ImportErrorPublic('A resposta não corresponde ao produto solicitado. A importação foi interrompida.')
    return offer

def price(value):
    try:
        n = float(value)
        return round(n, 2) if math.isfinite(n) and n >= 0 else None
    except (ValueError, TypeError):
        return None

def category(name):
    n = unicodedata.normalize('NFKD', name.lower()).encode('ascii', 'ignore').decode()
    groups = [
        ('Música', r'\b(bateria acustica|afinacao|guitarra|violao|instrumento|musical)\b'),
        ('Veículos', r'\b(automotivo|carro|moto|veiculo|capacete)\b'),
        ('Games', r'\b(console|gamer|video game|videogame|playstation|xbox)\b'),
        ('Pet', r'\b(pet|cachorro|gato|racao)\b'),
        ('Bebê', r'\b(bebe|fralda|mamadeira)\b'),
        ('Papelaria', r'\b(caneta|caderno|lapis|papelaria)\b'),
        ('Ferramentas', r'\b(ferramenta|ferramentas|furadeira|parafusadeira|alicate)\b'),
        ('Beleza', r'\b(protetor solar|maquiagem|skincare|creme|shampoo|batom)\b'),
        ('Fitness', r'\b(creatina|whey|fitness|academia|halter|haltere|treino|musculacao)\b'),
        ('Bolsas e Malas', r'\b(mochila|mala|bolsa|bolsas)\b'),
        ('Moda', r'\b(tenis|camiseta|blusa|shorts|bermuda|calca|vestido|cropped)\b'),
        ('Tecnologia', r'\b(bluetooth|fone|celular|smartphone|tablet|notebook|teclado|mouse)\b'),
        ('Casa', r'\b(lencol|organizador|organizadora|cozinha|panela|escova|limpeza)\b'),
    ]
    return next((c for c, pattern in groups if re.search(pattern, n)), 'Outros')

def image_versions(data):
    with Image.open(io.BytesIO(data)) as source:
        original_format = source.format
        image = ImageOps.exif_transpose(source).convert('RGBA' if 'A' in source.getbands() else 'RGB')
        if image.width < 1 or image.height < 1:
            raise ImportErrorPublic('A imagem do produto não é válida.')
        outputs = []
        for size, quality in [(480, 76), (1200, 84)]:
            resized = image.copy()
            resized.thumbnail((size, size), Image.Resampling.LANCZOS)
            out = io.BytesIO()
            resized.save(out, format='WEBP', quality=quality, method=6)
            outputs.append(out.getvalue())
        ext = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp'}.get(original_format)
        if not ext:
            raise ImportErrorPublic('Formato de imagem não suportado. São aceitos JPG, PNG e WebP.')
        return ext, outputs

def download_image(url):
    current = safe_url(url, image=True)
    opener = urllib.request.build_opener(NoRedirect)
    for _ in range(5):
        try:
            with opener.open(urllib.request.Request(current, headers={'User-Agent': 'MegaVitrine/1.0'}), timeout=30) as response:
                data = response.read(12_000_001)
                if len(data) > 12_000_000:
                    raise ImportErrorPublic('A imagem excede o limite de 12 MB.')
                return data
        except urllib.error.HTTPError as e:
            if e.code not in (301, 302, 303, 307, 308) or not e.headers.get('Location'):
                raise ImportErrorPublic('Não foi possível baixar a imagem da Shopee.') from None
            current = safe_url(urllib.parse.urljoin(current, e.headers['Location']), image=True)
    raise ImportErrorPublic('A imagem redirecionou muitas vezes.')

def import_product(url, app_id, secret, root):
    safe_url(url)
    if not app_id or not secret:
        raise ImportErrorPublic('Importação ainda não ativada. Configure SHOPEE_APP_ID e SHOPEE_SECRET nos Secrets do GitHub, depois da aprovação da Open API da Shopee.')
    shop_id, item_id = resolve_product(url)
    offer = request_offer(shop_id, item_id, app_id.strip(), secret.strip())
    name = str(offer.get('productName') or '').strip()
    if not name:
        raise ImportErrorPublic('A API não retornou o nome do produto.')
    affiliate = str(offer.get('offerLink') or '').strip()
    safe_url(affiliate)
    # Sempre usa o link de afiliado devolvido pelas credenciais do administrador.
    stem = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    stem = re.sub(r'[^a-z0-9]+', '-', stem).strip('-')[:65].rstrip('-') or 'produto'
    raw = download_image(str(offer.get('imageUrl') or ''))
    ext, versions = image_versions(raw)
    # O hash impede que uma nova importação altere fotos já usadas no catálogo.
    stem += f'-{shop_id}-{item_id}-{hashlib.sha256(raw).hexdigest()[:10]}'
    paths = [f'imagens/produtos/{stem}.webp', f'imagens/ampliadas/{stem}.webp', f'imagens/originais/{stem}.{ext}']
    for path, data in zip(paths, [*versions, raw]):
        dest = root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    pmin, pmax = price(offer.get('priceMin')), price(offer.get('priceMax'))
    product = {'nome': name[:180], 'categoria': category(name), 'descricao': '', 'imagem': paths[0], 'preco': pmin if pmin is not None else price(offer.get('price')), 'precoAnterior': None, 'destaque': False, 'url': affiliate}
    return {'ok': True, 'product': product, 'shopId': shop_id, 'itemId': item_id, 'priceMax': pmax, 'imageBytes': len(versions[0]), 'largeImageBytes': len(versions[1]), 'warnings': ['Categoria sugerida pelo nome; confira antes de cadastrar.', 'A API não fornece a descrição completa; esse campo fica vazio para você preencher se desejar.', 'O preço pode ser o menor entre variações; confira tamanho, modelo e anúncio.']}

def main():
    request_id = os.environ.get('IMPORT_REQUEST_ID', '')
    if not re.fullmatch(r'[a-f0-9]{32}', request_id):
        raise SystemExit('Identificador de importação inválido.')
    root = Path('.')
    try:
        result = import_product(os.environ.get('IMPORT_URL', ''), os.environ.get('SHOPEE_APP_ID', ''), os.environ.get('SHOPEE_SECRET', ''), root)
    except ImportErrorPublic as e:
        result = {'ok': False, 'error': str(e)}
    except Exception:
        result = {'ok': False, 'error': 'Não foi possível concluir a consulta ou otimizar a imagem. Tente novamente e confira o acesso à API da Shopee.'}
    folder = root / '.imports'
    folder.mkdir(exist_ok=True)
    (folder / (request_id + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Rascunho pronto para revisão.' if result['ok'] else result['error'])

if __name__ == '__main__':
    main()
