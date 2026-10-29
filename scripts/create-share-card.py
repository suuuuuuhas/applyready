"""Render the typographic share card. Requires Pillow; not needed to build the app."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
image = Image.new('RGB', (1200, 630), '#f4f6f1')
draw = ImageDraw.Draw(image)
fonts = Path('C:/Windows/Fonts')
regular = str(fonts / 'segoeui.ttf')
bold = str(fonts / 'segoeuib.ttf')
draw.rounded_rectangle((65, 54, 119, 108), radius=11, fill='#263118')
draw.text((77, 54), 'A', font=ImageFont.truetype(bold, 42), fill='#edf4d9')
draw.text((137, 60), 'ApplyReady', font=ImageFont.truetype(bold, 32), fill='#263118')
draw.text((65, 170), 'Fix the file.', font=ImageFont.truetype(bold, 88), fill='#263118')
draw.text((65, 270), 'Get back to applying.', font=ImageFont.truetype(bold, 76), fill='#7b865d')
draw.text((69, 395), 'Photo & signature preparation. Single images or batches.', font=ImageFont.truetype(regular, 30), fill='#5d6b50')
draw.line((69, 474, 1131, 474), fill='#c9d3bd', width=2)
draw.text((69, 510), 'Sourced requirements  /  Local processing  /  Originals preserved', font=ImageFont.truetype(regular, 25), fill='#405912')
image.save(root / 'public/share-card.png', optimize=True)
