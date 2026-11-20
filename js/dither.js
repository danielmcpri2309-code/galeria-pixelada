// =============================================================
//  dither.js — paleta del museo y dithering ordenado (Bayer 4×4)
// -------------------------------------------------------------
//  El DITHERING simula más colores de los que tienes mezclando
//  píxeles de los colores disponibles. Si quieres un tono que está
//  "a mitad" entre dos colores de la paleta, pintas la mitad de los
//  píxeles de uno y la mitad del otro; de lejos, el ojo los mezcla.
//
//  El dithering ORDENADO decide qué píxeles van de cada color con
//  una matriz fija (la matriz de Bayer), que se repite como un
//  azulejo de 4×4. Eso produce la trama regular tan característica
//  de los gráficos antiguos y de la imagen de referencia.
// =============================================================


// --- Paleta del museo (los mismos valores que en css/estilos.css) ---
const PALETA = {
  paredSombra: "#3E5A5D",
  paredOscura: "#5F8487",
  pared:       "#7A9FA1",
  paredClara:  "#9DBDBB",
  paredLuz:    "#C2D6D0",

  sueloSombra: "#6E664E",
  sueloOscuro: "#8E8466",
  suelo:       "#B9A985",
  sueloClaro:  "#D6C7A1",
  sueloLuz:    "#E8DCBA",

  negro:       "#0E0F10",
  carbon:      "#1B1C1E",
  grafito:     "#2A2C30",
  humo:        "#3A3D42",

  azul:        "#2D6BFF",
  azulClaro:   "#6FA0FF",
  blanco:      "#F2F2EE",
};


// Convierte "#7A9FA1" en [122, 159, 161] (rojo, verde, azul de 0 a 255)
function hexARgb(hex) {
  const numero = parseInt(hex.slice(1), 16);
  return [(numero >> 16) & 255, (numero >> 8) & 255, numero & 255];
}


// --- Rampas: cada material del museo, de su color más oscuro al más claro ---
// El dithering elige siempre entre dos colores VECINOS de una rampa.
const RAMPAS = {
  pared: [PALETA.paredSombra, PALETA.paredOscura, PALETA.pared, PALETA.paredClara, PALETA.paredLuz].map(hexARgb),
  suelo: [PALETA.sueloSombra, PALETA.sueloOscuro, PALETA.suelo, PALETA.sueloClaro, PALETA.sueloLuz].map(hexARgb),
  negro: [PALETA.negro, PALETA.carbon, PALETA.grafito, PALETA.humo].map(hexARgb),
};

const AZULES = {
  azul: hexARgb(PALETA.azul),
  claro: hexARgb(PALETA.azulClaro),
};


// --- Matriz de Bayer 4×4 ---
// Contiene los números del 0 al 15 colocados de forma que, al ir
// encendiendo píxeles en ese orden, la mezcla siempre queda repartida
// de manera uniforme (nunca se amontonan).
const BAYER_4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
];

// Umbral de Bayer para el píxel (x, y): un número entre 0 y 1.
// "& 3" es lo mismo que "% 4" para enteros positivos, pero más rápido.
function umbralBayer(x, y) {
  return (BAYER_4[y & 3][x & 3] + 0.5) / 16;
}


// -------------------------------------------------------------
//  colorDitherizado(rampa, valor, x, y)
//  "valor" es el brillo que queremos (0 = el color más oscuro de la
//  rampa, 1 = el más claro). Casi nunca cae justo en un color de la
//  rampa, sino entre dos: la parte decimal dice cuánto se acerca al
//  siguiente, y el umbral de Bayer decide si ESTE píxel sube o no.
// -------------------------------------------------------------
function colorDitherizado(rampa, valor, x, y) {
  const ultimo = rampa.length - 1;
  const posicion = Math.min(Math.max(valor, 0), 1) * ultimo;
  let indice = Math.floor(posicion);
  const fraccion = posicion - indice;
  if (indice < ultimo && fraccion > umbralBayer(x, y)) indice++;
  return rampa[indice];
}


// --- Ruido determinista ---
// Math.random() daría un resultado distinto cada vez que regeneramos
// el museo. Esta función "baraja" las coordenadas con multiplicaciones
// y desplazamientos de bits: parece aleatoria, pero para el mismo
// (x, y) devuelve siempre el mismo número entre 0 y 1.
function ruido(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Ruido suave en una dimensión: interpola entre valores aleatorios
// en los enteros, así que cambia poco a poco. Sirve para hacer
// "manchas" o grupos en lugar de puntos sueltos.
function ruidoSuave(x) {
  const entero = Math.floor(x);
  const t = x - entero;
  const suavizado = t * t * (3 - 2 * t);   // curva en S (smoothstep)
  const a = ruido(entero, 0);
  const b = ruido(entero + 1, 0);
  return a + (b - a) * suavizado;
}


// =============================================================
//  Pixelar una imagen (un cuadro) con la paleta del museo
// =============================================================
//  Para la pared usamos rampas (un material, de oscuro a claro).
//  Para los cuadros usamos TODOS los colores del museo a la vez:
//  cada píxel toma el color de la paleta que más se le parezca.
//  Así un cielo sale verde azulado, un manto dorado sale arena y
//  algún azul intenso sale con el azul "glitch".
// =============================================================

const PALETA_CUADROS = Object.values(PALETA).map(hexARgb);

// Color de la paleta más parecido a (r, g, b). Medimos la "distancia"
// entre colores como en el espacio 3D, pero dando más peso al verde,
// al que el ojo humano es más sensible (y menos al azul).
function colorMasCercano(r, g, b, paleta) {
  let mejor = paleta[0];
  let menorDistancia = Infinity;
  for (const color of paleta) {
    const dr = r - color[0];
    const dg = g - color[1];
    const db = b - color[2];
    const distancia = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      mejor = color;
    }
  }
  return mejor;
}

// -------------------------------------------------------------
//  ditherizarImagen(): devuelve un canvas de ancho×alto con la
//  imagen reducida y pixelada con la paleta.
//  Truco del dithering ordenado en color: antes de buscar el color
//  más cercano, sumamos a cada píxel un pequeño desplazamiento que
//  sale de la matriz de Bayer (unos píxeles un poco más claros, otros
//  un poco más oscuros). Así las zonas intermedias se reparten entre
//  dos colores de la paleta en vez de quedarse en uno solo.
//
//  getImageData() solo funciona si la imagen llegó con permiso CORS;
//  si no, lanza un error (SecurityError) que debe capturar quien llame.
//
//  Opciones (todas opcionales):
//    paleta      colores permitidos (por defecto, todos los del museo)
//    intensidad  fuerza del desplazamiento de Bayer
//    recorte     { sx, sy, sw, sh }: qué trozo de la imagen usar
//    brillo      multiplica el brillo (menos de 1 = más oscura)
// -------------------------------------------------------------
function ditherizarImagen(imagen, ancho, alto, opciones = {}) {
  const { paleta = PALETA_CUADROS, intensidad = 44, recorte = null, brillo = 1 } = opciones;

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d", { willReadFrequently: true });

  // Reducir la imagen: el navegador promedia los píxeles por nosotros
  ctx.imageSmoothingQuality = "high";
  if (recorte) {
    ctx.drawImage(imagen, recorte.sx, recorte.sy, recorte.sw, recorte.sh, 0, 0, ancho, alto);
  } else {
    ctx.drawImage(imagen, 0, 0, ancho, alto);
  }

  const datos = ctx.getImageData(0, 0, ancho, alto);   // ← aquí hace falta CORS
  const pixeles = datos.data;
  const { minimo, maximo } = nivelesAutomaticos(pixeles);
  const estirar = (255 / Math.max(maximo - minimo, 1)) * brillo;
  const SATURACION = 1.35;   // >1 aviva los colores para que elijan mejor su tono

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;

      // 1. Niveles: estiramos el contraste para usar toda la paleta
      let r = (pixeles[i] - minimo) * estirar;
      let g = (pixeles[i + 1] - minimo) * estirar;
      let b = (pixeles[i + 2] - minimo) * estirar;

      // 2. Saturación: alejamos cada canal del gris (su luminancia)
      const gris = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gris + (r - gris) * SATURACION;
      g = gris + (g - gris) * SATURACION;
      b = gris + (b - gris) * SATURACION;

      // 3. Dithering: desplazamiento de Bayer y color más cercano
      const desplazamiento = (umbralBayer(x, y) - 0.5) * intensidad;
      const color = colorMasCercano(r + desplazamiento, g + desplazamiento, b + desplazamiento, paleta);
      pixeles[i] = color[0];
      pixeles[i + 1] = color[1];
      pixeles[i + 2] = color[2];
      pixeles[i + 3] = 255;
    }
  }
  ctx.putImageData(datos, 0, 0);
  return lienzo;
}


// -------------------------------------------------------------
//  nivelesAutomaticos(): como el botón "Niveles automáticos" de un
//  editor de fotos. Hace un histograma (cuántos píxeles hay de cada
//  brillo, de 0 a 255) y busca el brillo por debajo del cual queda
//  el 2 % más oscuro y por encima del cual queda el 2 % más claro.
//  Ignorar esos extremos evita que un solo punto negro o blanco
//  arruine el ajuste.
// -------------------------------------------------------------
function nivelesAutomaticos(pixeles, recorte = 0.02) {
  const histograma = new Array(256).fill(0);
  const total = pixeles.length / 4;
  for (let i = 0; i < pixeles.length; i += 4) {
    const brillo = Math.round(0.299 * pixeles[i] + 0.587 * pixeles[i + 1] + 0.114 * pixeles[i + 2]);
    histograma[brillo]++;
  }

  let acumulado = 0;
  let minimo = 0;
  while (minimo < 255 && acumulado + histograma[minimo] <= total * recorte) acumulado += histograma[minimo++];

  acumulado = 0;
  let maximo = 255;
  while (maximo > 0 && acumulado + histograma[maximo] <= total * recorte) acumulado += histograma[maximo--];

  return { minimo, maximo };
}


// -------------------------------------------------------------
//  Máscaras de "disolución" con la matriz de Bayer.
//  Creamos 17 dibujos de 4×4 celdas (niveles 0 a 16). En el nivel k
//  se ven las celdas cuyo número de Bayer es menor que k: en el 0 no
//  se ve ninguna, en el 8 la mitad (repartidas en damero) y en el 16
//  todas. Usadas como mask-image de CSS sobre la imagen real, hacen
//  que aparezca píxel a píxel, como en los fundidos de los juegos
//  antiguos.
//
//  "tamCelda" es el tamaño de un píxel lógico en píxeles FÍSICOS:
//  dibujamos la máscara justo a ese tamaño para que el navegador no
//  tenga que ampliarla (y difuminarla).
// -------------------------------------------------------------
function crearMascarasBayer(tamCelda) {
  const mascaras = [];
  for (let nivel = 0; nivel <= 16; nivel++) {
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = 4 * tamCelda;
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#000";   // en una máscara lo que importa es lo opaco: eso se ve
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if (BAYER_4[y][x] < nivel) ctx.fillRect(x * tamCelda, y * tamCelda, tamCelda, tamCelda);
      }
    }
    mascaras.push(`url(${lienzo.toDataURL()})`);
  }
  return mascaras;
}


// -------------------------------------------------------------
//  recorteCubrir(): el equivalente a object-fit: cover. Calcula qué
//  trozo de una imagen hay que coger para llenar un hueco de
//  ancho×alto sin deformarla (sobra por los lados o por arriba y
//  abajo). "sesgo" decide de dónde se recorta en vertical: 0 = se
//  queda con la parte de arriba, 0,5 = el centro, 1 = la de abajo.
// -------------------------------------------------------------
function recorteCubrir(anchoImagen, altoImagen, ancho, alto, sesgo = 0.5) {
  const escala = Math.max(ancho / anchoImagen, alto / altoImagen);
  const sw = ancho / escala;
  const sh = alto / escala;
  return { sx: (anchoImagen - sw) / 2, sy: (altoImagen - sh) * sesgo, sw, sh };
}


// Atajo para pintar un rectángulo de un color en una sola línea
function rect(ctx, color, x, y, ancho, alto) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, ancho, alto);
}
