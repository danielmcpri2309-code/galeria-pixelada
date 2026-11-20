// =============================================================
//  portada.js — la pantalla de inicio y la ayuda "Cómo se juega"
// -------------------------------------------------------------
//  Copia la composición de la imagen de referencia. De atrás
//  hacia delante:
//    1. Fondo: "Campo de trigo con cipreses" de Van Gogh, pixelado
//       con la paleta del museo (la misma función que los cuadros).
//    2. Panel oscuro abajo, con "monitores" llenos de píxeles,
//       como la torre de control de la referencia.
//    3. El personaje, enorme y de espaldas, mirando el cuadro.
//    4. Título, frase, botón píldora y enlace.
//  Al entrar, toda la portada se deshace píxel a píxel (máscaras
//  de Bayer) y deja ver el museo, que ya estaba detrás.
// =============================================================

const OBRA_PORTADA = OBRAS.find((obra) => obra.titulo === "Campo de trigo con cipreses") || OBRAS[0];

const portada = {
  elemento: document.getElementById("portada"),
  fondo: document.getElementById("portada-fondo"),
  personaje: document.getElementById("portada-personaje"),
  entrar: document.getElementById("portada-entrar"),
  enlaceAyuda: document.getElementById("portada-ayuda"),
  numeroObras: document.getElementById("portada-numero"),
  progreso: document.getElementById("portada-progreso"),
};

const ayuda = {
  dialogo: document.getElementById("ayuda"),
  cerrar: document.getElementById("ayuda-cerrar"),
};

let enPortada = true;          // mientras sea true, el juego no recibe teclas
let imagenPortada = null;      // la imagen de Van Gogh, cuando haya cargado
let fondoSinPixelar = false;   // plan B si no se pueden leer sus píxeles

const ALTO_PANEL = 0.24;       // el panel oscuro ocupa el 24 % de abajo
const MARGEN_CUADRO = 0.03;    // recortamos un 3 % por cada lado (la foto trae el borde del lienzo)

// Paleta del fondo: la del museo SIN los tonos más claros, para que
// el cielo quede verde azulado (como en la referencia) y el texto
// blanco se lea bien encima.
const PALETA_PORTADA = [
  PALETA.paredSombra, PALETA.paredOscura, PALETA.pared, PALETA.paredClara,
  PALETA.sueloSombra, PALETA.sueloOscuro, PALETA.suelo, PALETA.sueloClaro,
  PALETA.negro, PALETA.carbon, PALETA.grafito, PALETA.humo, PALETA.azul,
].map(hexARgb);

function portadaVisible() {
  return enPortada;
}


// -------------------------------------------------------------
//  Dibujo de la portada
// -------------------------------------------------------------
//  Igual que el museo: un canvas pequeño (píxeles lógicos) ampliado
//  con una escala entera de píxeles físicos.
function dibujarPortada() {
  const dpr = window.devicePixelRatio || 1;
  const anchoCss = window.innerWidth;
  const altoCss = window.innerHeight;
  const escala = Math.max(2, Math.round((altoCss * dpr) / 220));
  const escalaCss = escala / dpr;
  const ancho = Math.ceil(anchoCss / escalaCss);
  const alto = Math.ceil(altoCss / escalaCss);

  const lienzo = portada.fondo;
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.style.width = ancho * escalaCss + "px";
  lienzo.style.height = alto * escalaCss + "px";
  const ctx = lienzo.getContext("2d");

  const altoPanel = Math.round(alto * ALTO_PANEL);
  const altoCuadro = alto - altoPanel + 2;   // el cuadro llega un poco por debajo del panel

  // 1. El cuadro (o el verde azulado de la pared mientras carga)
  rect(ctx, PALETA.pared, 0, 0, ancho, altoCuadro);
  if (imagenPortada) {
    // Recortamos como object-fit: cover, quedándonos más con la parte
    // de arriba (el cielo), que es donde va el texto. Antes quitamos
    // un margen por cada lado para que no se vea el borde del lienzo.
    const anchoImg = imagenPortada.naturalWidth;
    const altoImg = imagenPortada.naturalHeight;
    const recorte = recorteCubrir(anchoImg * (1 - 2 * MARGEN_CUADRO), altoImg * (1 - 2 * MARGEN_CUADRO), ancho, altoCuadro, 0.3);
    recorte.sx += anchoImg * MARGEN_CUADRO;
    recorte.sy += altoImg * MARGEN_CUADRO;

    if (fondoSinPixelar) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(imagenPortada, recorte.sx, recorte.sy, recorte.sw, recorte.sh, 0, 0, ancho, altoCuadro);
    } else {
      const pixelado = ditherizarImagen(imagenPortada, ancho, altoCuadro, { recorte, paleta: PALETA_PORTADA, brillo: 0.82 });
      ctx.drawImage(pixelado, 0, 0);
    }
  }

  // 2. El panel de monitores
  dibujarPanel(ctx, ancho, alto, alto - altoPanel);

  // 3. El personaje de espaldas, enorme (ver colocarPersonajePortada)
  colocarPersonajePortada(dpr);
}


// Panel oscuro con monitores. Todo el "texto" de las pantallas es
// ruido determinista: rayitas grises y algún píxel azul.
function dibujarPanel(ctx, ancho, alto, y0) {
  // Fondo del panel con un poco de grano (dithering de la rampa negra)
  const imagen = ctx.createImageData(ancho, alto - y0);
  let i = 0;
  for (let y = y0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const color = colorDitherizado(RAMPAS.negro, 0.2 + (ruido(x, y) - 0.5) * 0.15, x, y);
      imagen.data[i] = color[0];
      imagen.data[i + 1] = color[1];
      imagen.data[i + 2] = color[2];
      imagen.data[i + 3] = 255;
      i += 4;
    }
  }
  ctx.putImageData(imagen, 0, y0);

  // Monitores
  const cuantos = Math.max(2, Math.round(ancho / 80));
  const separacion = 4;
  const anchoMonitor = Math.floor((ancho - separacion * (cuantos + 1)) / cuantos);
  for (let m = 0; m < cuantos; m++) {
    const x = separacion + m * (anchoMonitor + separacion);
    dibujarMonitor(ctx, x, y0 + 4, anchoMonitor, alto - y0, m);
  }

  // Borde de arriba con píxeles azules "glitch", agrupados
  for (let x = 0; x < ancho; x++) {
    const grupo = ruidoSuave(x / 7) > 0.45 ? 1 : 0.2;
    for (let dy = -2; dy <= 1; dy++) {
      const probabilidad = (dy === 0 || dy === -1 ? 0.5 : 0.2) * grupo;
      if (ruido(x + 900, y0 + dy) < probabilidad) {
        rect(ctx, ruido(x, dy + 77) < 0.75 ? PALETA.azul : PALETA.azulClaro, x, y0 + dy, 1, 1);
      }
    }
  }
}

function dibujarMonitor(ctx, x, y, ancho, alto, semilla) {
  rect(ctx, PALETA.grafito, x, y, ancho, alto);              // carcasa
  rect(ctx, PALETA.humo, x, y, ancho, 1);                    // brillo de arriba
  rect(ctx, PALETA.negro, x + 2, y + 2, ancho - 4, alto);    // pantalla

  // Filas de "texto": rayitas de largo aleatorio
  for (let fila = y + 5; fila < y + alto - 2; fila += 3) {
    if (ruido(semilla * 31, fila) < 0.25) continue;          // alguna fila vacía
    let cx = x + 5;
    const limite = x + ancho - 5 - Math.floor(ruido(fila, semilla) * ancho * 0.4);
    while (cx < limite) {
      const largo = 1 + Math.floor(ruido(cx, fila + semilla) * 7);
      const azar = ruido(cx + 500, fila);
      const color = azar < 0.12 ? PALETA.azul : azar < 0.2 ? PALETA.azulClaro : azar < 0.6 ? PALETA.humo : PALETA.grafito;
      rect(ctx, color, cx, fila, Math.min(largo, limite - cx), 1);
      cx += largo + 1 + Math.floor(ruido(fila, cx) * 3);
    }
  }
}


// El sprite de espaldas (16×44) ampliado a escala entera. Lo bajamos
// para que las piernas queden fuera de la pantalla: se ve la cabeza
// por encima del panel y el traje delante de los monitores.
function colocarPersonajePortada(dpr) {
  const lienzo = portada.personaje;
  if (lienzo.width !== ANCHO_SPRITE) {
    lienzo.width = ANCHO_SPRITE;
    lienzo.height = ALTO_SPRITE;
    lienzo.getContext("2d").drawImage(SPRITES.espalda, 0, 0);
  }
  const altoFisico = window.innerHeight * dpr;
  const anchoFisico = window.innerWidth * dpr;
  // Que la cabeza llegue a media pantalla, sin pasar de la mitad del ancho
  const escala = Math.max(3, Math.min(
    Math.round((altoFisico * 0.48) / FILAS_CUERPO),
    Math.floor((anchoFisico * 0.5) / ANCHO_SPRITE),
  ));
  const escalaCss = escala / dpr;
  lienzo.style.width = ANCHO_SPRITE * escalaCss + "px";
  lienzo.style.height = ALTO_SPRITE * escalaCss + "px";
  lienzo.style.bottom = -(ALTO_SPRITE - FILAS_CUERPO) * escalaCss + "px";   // piernas fuera
}


// -------------------------------------------------------------
//  Carga del cuadro de fondo (con CORS, como los de la pared)
// -------------------------------------------------------------
function cargarFondoPortada() {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    imagenPortada = img;
    try {
      dibujarPortada();
    } catch (error) {
      // No podemos leer sus píxeles: se verá sin pixelar (plan B)
      fondoSinPixelar = true;
      dibujarPortada();
    }
  };
  img.onerror = () => {
    // Plan B: sin CORS la imagen se puede dibujar, pero no pixelar
    if (img.crossOrigin === null) return;   // ya lo habíamos intentado
    img.crossOrigin = null;
    fondoSinPixelar = true;
    img.src = OBRA_PORTADA.imagen;
  };
  img.src = OBRA_PORTADA.imagen + PARAMETRO_CORS;
}


// -------------------------------------------------------------
//  Entrar al museo
// -------------------------------------------------------------
function entrarAlMuseo() {
  if (!enPortada) return;
  enPortada = false;
  if (document.activeElement) document.activeElement.blur();   // que Enter no vuelva a pulsar el botón
  portada.elemento.style.pointerEvents = "none";
  // La portada se deshace píxel a píxel (de 16 a 0) y luego se oculta
  animarMascara(portada.elemento, REVELADO.niveles, 0, 700, () => {
    portada.elemento.hidden = true;
  });
}


// -------------------------------------------------------------
//  Ayuda "Cómo se juega" (otro <dialog>)
// -------------------------------------------------------------
function abrirAyuda(evento) {
  if (evento) evento.preventDefault();   // el enlace no debe navegar a "#ayuda"
  ayuda.dialogo.showModal();
}


// -------------------------------------------------------------
//  Favicon: la cabeza del personaje, sacada de su propio sprite
// -------------------------------------------------------------
function ponerFavicon() {
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = 16;
  lienzo.getContext("2d").drawImage(SPRITES.espalda, 0, 0, 16, 16, 0, 0, 16, 16);
  const enlace = document.createElement("link");
  enlace.rel = "icon";
  enlace.href = lienzo.toDataURL();
  document.head.append(enlace);
}


// -------------------------------------------------------------
//  Arranque de la portada
// -------------------------------------------------------------
function iniciarPortada() {
  portada.numeroObras.textContent = OBRAS.length;
  if (obrasVistas.size > 0) {
    portada.progreso.textContent = `Llevas ${obrasVistas.size} de ${OBRAS.length} obras vistas`;
    portada.progreso.hidden = false;
  }

  portada.entrar.addEventListener("click", entrarAlMuseo);
  portada.enlaceAyuda.addEventListener("click", abrirAyuda);
  ayuda.cerrar.addEventListener("click", () => ayuda.dialogo.close());

  // Al cambiar el tamaño de la ventana hay que volver a pixelar el
  // fondo. Esperamos a que deje de cambiar ~150 ms ("debounce") para
  // no repetir el trabajo decenas de veces mientras se arrastra.
  let espera = null;
  window.addEventListener("resize", () => {
    if (!enPortada) return;
    clearTimeout(espera);
    espera = setTimeout(dibujarPortada, 150);
  });

  ponerFavicon();
  dibujarPortada();       // primero sin cuadro (verde azulado)…
  cargarFondoPortada();   // …y en cuanto llegue la imagen, con él
}

iniciarPortada();
