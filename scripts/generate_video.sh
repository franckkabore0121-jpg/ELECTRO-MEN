#!/bin/bash
set -e

mkdir -p public/assets/videos

echo "Generating ELECTRO-MEN Industrial Hero Video..."

# Generate a 6-second 1280x720 30fps high-tech industrial loop with audio
ffmpeg -y \
  -f lavfi -i "color=c=#030712:s=1280x720:d=6:r=30" \
  -loop 1 -i "public/assets/aistudio/Image_1_397aca35.jpeg" \
  -f lavfi -i "anoisesrc=d=6:c=pink:r=44100:a=0.015,lowpass=f=300,volume=0.3" \
  -filter_complex "
    [0:v]
      drawgrid=width=64:height=64:thickness=1:color=#0f172a@0.6,
      drawgrid=width=192:height=192:thickness=1:color=#1e293b@0.8,
      drawbox=x=0:y=0:w=1280:h=720:color=#000000@0.2:t=fill
    [grid];

    [1:v]
      scale=110:110,
      format=rgba,
      pad=116:116:3:3:color=#d97706@0.8
    [logo];

    [grid][logo]
      overlay=x=60:y=50:shortest=1
    [v1];

    [v1]
      drawbox=x=0:y='360+sin(t*3)*180':w=1280:h=2:color=#38bdf8@0.4:t=fill,
      drawbox=x='640+cos(t*2)*500':y=0:w=2:h=720:color=#f59e0b@0.3:t=fill,
      drawbox=x=50:y=180:w=1180:h=1:color=#334155@0.8:t=fill,
      drawbox=x=50:y=620:w=1180:h=1:color=#334155@0.8:t=fill,

      drawtext=text='ELECTRO-MEN':fontcolor=#f8fafc:fontsize=48:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=196:y=60,
      drawtext=text='POLE INDUSTRIEL ET INGENIERIE DE POINTE':fontcolor=#fbbf24:fontsize=17:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=198:y=116,
      drawtext=text='BURKINA FASO':fontcolor=#94a3b8:fontsize=14:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=198:y=140,

      drawtext=text='ELECTRONIQUE INDUSTRIELLE':fontcolor=#38bdf8:fontsize=28:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=60:y=240,
      drawtext=text='Microcontroleurs ESP32 | STM32 | Capteurs IoT | Cartes de Prototypage':fontcolor=#cbd5e1:fontsize=16:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=60:y=280,

      drawtext=text='ELECTROTECHNIQUE & PUISSANCE':fontcolor=#f59e0b:fontsize=28:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=60:y=340,
      drawtext=text='Variateurs VFD | Armoires de Distribution | Disjoncteurs Schneider':fontcolor=#cbd5e1:fontsize=16:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=60:y=380,

      drawtext=text='EQUIPEMENTS INFORMATIQUES & RESEAUX':fontcolor=#10b981:fontsize=28:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=60:y=440,
      drawtext=text='Postes de Travail | Serveurs | Infrastructures & Maintenance':fontcolor=#cbd5e1:fontsize=16:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=60:y=480,

      drawtext=text='QUALITE CERTIFIEE  *  EXPEDITION RAPIDE  *  DISPONIBILITE IMMEDIATE':fontcolor=#e2e8f0:fontsize=15:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=60:y=560,

      drawbox=x=980:y=50:w=250:h=110:color=#0f172a@0.9:t=fill,
      drawbox=x=980:y=50:w=250:h=110:color=#f59e0b@0.6:t=1,
      drawtext=text='ETAT DU SYSTEME':fontcolor=#94a3b8:fontsize=11:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=995:y=65,
      drawtext=text='SERVICES ACTIFS':fontcolor=#34d399:fontsize=16:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=995:y=85,
      drawtext=text='OUAGADOUGOU':fontcolor=#e2e8f0:fontsize=12:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=995:y=112,
      drawtext=text='+226 65 48 47 38':fontcolor=#38bdf8:fontsize=13:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=995:y=132,

      drawtext=text='ELECTRO-MEN OFFICIAL BROADCAST':fontcolor=#64748b:fontsize=12:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=60:y=650,
      drawtext=text='2026 HIGH-TECH CATALOG':fontcolor=#64748b:fontsize=12:fontfile=/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf:x=1050:y=650
    [outv]
  " \
  -map "[outv]" -map 2:a \
  -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.0 -preset fast -crf 23 -movflags +faststart \
  -c:a aac -b:a 64k \
  -t 6 \
  public/assets/videos/electromen-hero.mp4

echo "Video generated successfully: public/assets/videos/electromen-hero.mp4"
