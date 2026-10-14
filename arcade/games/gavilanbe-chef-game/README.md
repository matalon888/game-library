<div align="center">
  <img src="docs/screenshots/01-title.png" width="640" alt="¡Chef!">
</div>

# 🍳 ¡Chef!

**Malabares de cocina: atrapa la comida en la sartén, dórala en su punto justo y sírvela antes de que se queme.**

[![jugar ahora](https://img.shields.io/badge/▶_jugar_ahora-F2A93B?style=for-the-badge&labelColor=160E08)](https://gavilanbe.github.io/chef-game/)

![Canvas 2D](https://img.shields.io/badge/HTML5-Canvas_2D-F2A93B?style=flat-square)
![Sin build](https://img.shields.io/badge/sin_build-1_archivo-9C5B33?style=flat-square)
![Estilo](https://img.shields.io/badge/estilo-arcade_de_reflejos-E8A44C?style=flat-square)
![MIT](https://img.shields.io/badge/licencia-MIT-4A3328?style=flat-square)

---

## Qué es esto

Un arcade de reflejos hecho en un solo `index.html` con HTML5 Canvas puro. Mueve la sartén de lado a lado, caza los ingredientes que caen, cocínalos hasta el punto perfecto y sírvelos al cliente. Encadena combos, no se te quemen y bate tu récord.

## 📖 La historia

Eres el chef y la cocina es un caos: la comida vuela por los aires y solo tienes una sartén. Cada ingrediente —huevo, gamba, tortita, filete o muslo— tiene su punto de cocción exacto. Si lo sirves crudo, no cuela; si lo dejas de más, se carboniza y pierdes una vida. El cliente espera, la dificultad sube con cada plato servido y tu única misión es no perder el ritmo.

## 🎮 Cómo se juega

Atrapa la comida, déjala en la sartén hasta que esté en su punto (ni cruda ni quemada) y sírvela en la ventana justa. Cada acierto encadenado sube el combo.

| Acción | Tecla / Gesto |
|---|---|
| Mover la sartén | ← → o ratón |
| Empezar a jugar | Espacio |
| Pausa | P |
| Mover (móvil) | Arrastrar el dedo |

## 📸 Capturas

| | |
|---|---|
| ![](docs/screenshots/02-play.png) | ![](docs/screenshots/03-action.png) |

## ▶️ Jugar

Juégalo directamente en el navegador: **[gavilanbe.github.io/chef-game](https://gavilanbe.github.io/chef-game/)**

O en local, sin instalar nada:

```bash
python3 -m http.server 8000
# luego abre http://localhost:8000
```

## 🛠️ Bajo el capó

- **HTML5 Canvas 2D**: todo el render está dibujado por código, sin imágenes externas.
- **JavaScript vanilla**, sin frameworks ni dependencias ni build.
- Audio generado en vivo con la **Web Audio API** (oscilladores para cada efecto).
- Cinco ingredientes con su propio punto de cocción, sistema de combos, vidas y dificultad creciente.
- Partículas, salpicaduras, sacudidas de pantalla y animaciones dibujadas a mano.
- Récord persistido en `localStorage`.
- Tipografía *Lilita One* vía Google Fonts.

## 📦 Créditos

Publicado por [@gavilanbe](https://github.com/gavilanbe). Proyecto personal hecho por diversión. ¡Que aproveche! 🍽️

## 📄 Licencia

[MIT](LICENSE)
