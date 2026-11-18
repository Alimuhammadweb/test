"""Generates the fixture images used by run.py (a >4 MB photo, PNG, WebP, corrupt JPEG, GIF, HTML disguised as PNG)."""
from PIL import Image, ImageDraw
import os
cols = [(200,60,60),(60,160,90),(60,90,200),(220,180,40),(150,60,180)]
def photo(w,h,seed,name,fmt,**kw):
    im = Image.effect_noise((w,h), 90).convert("RGB")
    im = Image.blend(im, Image.new("RGB",(w,h),cols[seed]), 0.45)
    d = ImageDraw.Draw(im); d.rectangle([0,0,w//3,h//3], fill=cols[seed]); d.text((20,20), f"IMG {seed}", fill=(255,255,255))
    im.save(name, fmt, **kw)
photo(4200,3000,0,"big.jpg","JPEG",quality=97); photo(1200,800,1,"a.jpg","JPEG",quality=85)
photo(1000,1000,2,"b.png","PNG"); photo(1400,900,3,"c.webp","WEBP",quality=85); photo(900,600,4,"d.jpg","JPEG",quality=85)
open("corrupt.jpg","wb").write(b"\xff\xd8\xff\xe0"+os.urandom(3000))
Image.new("RGB",(50,50),"red").save("anim.gif","GIF")
open("fake.png","wb").write(b"<script>alert(1)</script>"+b" "*200)
