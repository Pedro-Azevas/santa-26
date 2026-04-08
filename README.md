# Santa 26

Projeto React + Vite pronto para publicar no Vercel.

## O que já está configurado
- leitura do JSON do Apps Script
- mapa interativo com a imagem enviada
- popup lateral com horários
- links do Google Forms vindos da planilha
- lista de barracas no estilo do layout

## Antes de publicar
Se quiser ajustar algo:
- `src/App.jsx`
  - `JSON_URL`: endpoint do Apps Script
  - `POSICOES_MAPA`: posições X/Y dos IDs no mapa
- `public/mapa-festa.jpeg`: substitua se quiser outro export do mapa

## Rodar localmente
1. Instale Node.js
2. Rode:
   npm install
   npm run dev

## Publicar no Vercel
1. Suba esta pasta para o GitHub
2. No Vercel, importe o repositório
3. Clique em Deploy
