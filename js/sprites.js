// =============================================================
//  sprites.js — el personaje en pixel art, dibujado con código
// -------------------------------------------------------------
//  Cada sprite es una MATRIZ DE CARACTERES: un array de textos,
//  uno por fila, en el que cada letra es un píxel de un color
//  (ver COLORES_PERSONAJE) y el punto "." es transparente.
//
//  Al cargar la página convertimos cada matriz en un canvas
//  pequeño (16×44). Después, en cada fotograma, basta con copiarlo
//  con drawImage, que es muy rápido.
//
//  El personaje sale de la referencia: pelo castaño rizado, traje
//  oscuro y el cuello blanco de la camisa asomando.
// =============================================================


// --- Medidas y tiempos de la animación ---
const ANCHO_SPRITE = 16;
const ALTO_SPRITE = 44;
const LONGITUD_FOTOGRAMA = 9;  // píxeles que avanza el personaje en cada fotograma al andar
const RETRASO_GIRO = 0.25;     // segundos quieto delante de un cuadro antes de girarse
const PERIODO_RESPIRAR = 0.9;  // segundos entre "inspirar" y "espirar" cuando está parado


// --- Qué color es cada letra ---
const COLORES_PERSONAJE = {
  H: "#3A2416",        // pelo oscuro
  h: "#5C3B26",        // pelo
  c: "#8A5D3B",        // brillo de los rizos
  S: "#D9A982",        // piel
  s: "#A9744F",        // piel en sombra (orejas, cuello, barbilla)
  W: PALETA.blanco,    // camisa
  w: "#BFC3C0",        // camisa en sombra
  T: PALETA.carbon,    // traje
  t: PALETA.grafito,   // traje un poco más claro
  u: PALETA.humo,      // brillo del traje (donde le da la luz de los focos)
  K: PALETA.negro,     // sombras, pierna del fondo y zapatos
  A: PALETA.azul,      // un píxel azul "glitch", como en la referencia
};


// =============================================================
//  De espaldas (mirando un cuadro). Es casi simétrico.
// =============================================================
const ESPALDA = [
  "......hHch......",   //  0  pelo rizado
  ".....hcHhHh.....",
  "....hHhcHHch....",
  "...hHcHhHchHh...",
  "...cHhHHhHHhc...",
  "...HhcHhcHhHH...",   //  5
  "...hHHhHHhcHh...",
  "...sHcHhHHhHs...",   //  orejas
  "...shHHhHcHHA...",
  "....HhHHhHHh....",
  "....hHHcHhHH....",   // 10
  ".....HhHHhH.....",   //     nuca
  "......sSSs......",   //     cuello
  ".....wWWWWw.....",   //     cuello de la camisa
  "...tTTTTTTTTt...",   //     cuello de la chaqueta
  ".utTTTTTTTTTTtu.",   // 15  hombros
  ".tTTTTTTTTTTTTt.",
  ".TTKTTTTTTTTKTT.",   //     brazos separados del cuerpo por una línea oscura
  ".TTKTTTTTTTTKTT.",
  ".TTKTTTTTTTTKTT.",
  ".TTKTTTTTTTTKTT.",   // 20
  ".TTKTTTTTTTTKTT.",
  ".TTKTTTTTTTTKTT.",
  ".TTKTTTTTTTTKTT.",
  ".TTKTTTTTTTTKTT.",
  ".TTKTTTTTTTTKTT.",   // 25
  ".TTKTTTKKTTTKTT.",   //     abertura de la chaqueta
  ".TTKTTTKKTTTKTT.",
  ".sSKTTTKKTTTKSs.",   //     manos
  ".sSKTTTKKTTTKSs.",
  "....TTTTTTTT....",   // 30  pantalón
  "....TTTTTTTT....",
  "....TTTTTTTT....",
  "....TTTKKTTT....",   //     dos piernas
  "....TTTKKTTT....",
  "....TTTKKTTT....",   // 35
  "....TTTKKTTT....",
  "....TTTKKTTT....",
  "....TTTKKTTT....",
  "....TTTKKTTT....",
  "....TTTKKTTT....",   // 40
  "....TTTKKTTT....",
  "...uKKK..KKKu...",   //     talones de los zapatos
  "...KKKK..KKKK...",
];


// =============================================================
//  De lado (mirando a la derecha). Para no repetir lo que no
//  cambia, el sprite se monta con tres piezas: cabeza (filas
//  0–13), torso con el brazo (14–29) y piernas (30–43).
// =============================================================

const CABEZA_LADO = [
  "......hHch......",   //  0
  ".....hcHhHhh....",
  "....hHhcHHchh...",
  "...hcHhHHhHhch..",
  "...HhHchHhHhch..",
  "...hHhHHcHhSSh..",   //  5  frente con un rizo encima
  "...cHHhHhSSSSS..",
  "...hHhHHsSSKSS..",   //     oreja (s) y ojo (K)
  "...HhHhHsSSSSSS.",   //     nariz
  "...hHHhHhSSSSs..",
  "....HhHhSSSSs...",   // 10
  ".....HhHsSSs....",   //     mandíbula
  "......sSSs......",   //     cuello
  ".....wWWWw......",   //     cuello de la camisa
];

// El brazo que vemos se balancea: hacia atrás, en el centro o hacia delante
const TORSO_LADO = {
  centro: [
    "....TTTTTTtW....",   // 14
    "....TTtuuTtW....",   // 15  hombro
    "....TTtuuTTt....",
    "....TTtuuTTT....",
    "....TTtuuTTT....",
    "....TTtuuTTT....",
    "....TTtuuTTT....",   // 20
    "....TTTtuTTT....",   //     antebrazo
    "....TTTtuTT.....",
    "....TTTtuTT.....",
    "....TTTtuTT.....",
    "....TTTtuTT.....",   // 25
    "....TTTtuTT.....",
    "....TTTSsTT.....",   //     mano
    "....TTTSsTT.....",
    "....KTTTTTK.....",   // 29  bajo de la chaqueta
  ],
  delante: [
    "....TTTTTTtW....",
    "....TTtuuTtW....",
    "....TTTtuuTt....",
    "....TTTtuuTT....",
    "....TTTTtuuT....",
    "....TTTTtuuT....",
    "....TTTTTtuu....",
    "....TTTTTtuu....",
    "....TTTTTTTu....",
    "....TTTTTTTtu...",
    "....TTTTTTTtu...",
    "....TTTTTTT.Ss..",   //     mano por delante del cuerpo
    "....TTTTTTT.Ss..",
    "....TTTTTTT.....",
    "....TTTTTTT.....",
    "....KTTTTTK.....",
  ],
  atras: [
    "....TTTTTTtW....",
    "....TuutTTtW....",
    "....uutTTTTt....",
    "...uutTTTTTT....",
    "...utTTTTTTT....",
    "...utTTTTTTT....",
    "..utTTTTTTTT....",
    "..utTTTTTTTT....",
    "..utTTTTTTT.....",
    ".ut.TTTTTTT.....",
    ".ut.TTTTTTT.....",
    ".Ss.TTTTTTT.....",   //     mano por detrás del cuerpo
    ".Ss.TTTTTTT.....",
    "....TTTTTTT.....",
    "....TTTTTTT.....",
    "....KTTTTTK.....",
  ],
};

// Piernas: la que está más cerca de nosotros es "T" y la del fondo,
// más oscura, "K". Un paso tiene cuatro posturas.
const PIERNAS_LADO = {
  quieto: [
    ".....TTTTT......",   // 30
    ".....TTTTT......",
    ".....KTTTT......",
    ".....KTTT.......",
    ".....KTTT.......",
    ".....KTTT.......",   // 35
    ".....KTTT.......",
    ".....KTTT.......",
    ".....KTTT.......",
    ".....KTTT.......",
    ".....KTTT.......",   // 40
    ".....KTTT.......",
    ".....KKKKKu.....",   //     zapatos, con un brillo en la punta
    ".....KKKKKKu....",
  ],
  // 1. Pierna cercana delante, la del fondo detrás
  pasoA: [
    ".....TTTTT......",
    ".....KTTTT......",
    ".....KKTTT......",
    "....KKK.TTT.....",
    "....KKK.TTT.....",
    "....KKK..TTT....",
    "...KKK...TTT....",
    "...KKK...TTT....",
    "...KKK....TTT...",
    "..KKK.....TTT...",
    "..KKK.....TTT...",
    "..KKK.....TTT...",
    "..KKK.....KKKKu.",
    "..KKKK....KKKKK.",
  ],
  // 2. Se cruzan: la cercana apoya y la del fondo se levanta detrás
  cruceA: [
    ".....TTTTT......",
    ".....KTTTT......",
    ".....KTTT.......",
    "....KKTTT.......",
    "....KKTTT.......",
    "....KKTTT.......",
    "....KKTTT.......",
    "...KK.TTT.......",
    "..KK..TTT.......",
    "..KKK.TTT.......",
    "......TTT.......",
    "......TTT.......",
    "......KKKKu.....",
    "......KKKKKK....",
  ],
  // 3. Al revés que el 1: la del fondo delante, la cercana detrás
  pasoB: [
    ".....TTTTT......",
    ".....TTTTK......",
    ".....TTTKK......",
    "....TTT.KKK.....",
    "....TTT.KKK.....",
    "....TTT..KKK....",
    "...TTT...KKK....",
    "...TTT...KKK....",
    "...TTT....KKK...",
    "..TTT.....KKK...",
    "..TTT.....KKK...",
    "..TTT.....KKK...",
    "..KKu.....KKKKK.",
    "..KKKK....KKKKK.",
  ],
  // 4. Se cruzan otra vez: apoya la del fondo y se levanta la cercana
  cruceB: [
    ".....TTTTT......",
    ".....TTTKK......",
    ".....TTKKK......",
    "....TTTKKK......",
    "....TTTKKK......",
    "....TTTKKK......",
    "....TT.KKK......",
    "...TT..KKK......",
    "..TT...KKK......",
    "..KKu..KKK......",
    ".......KKK......",
    ".......KKK......",
    ".......KKKKK....",
    ".......KKKKKK...",
  ],
};


// -------------------------------------------------------------
//  bajarFilas(matriz, hasta): devuelve una COPIA de la matriz en
//  la que las filas de arriba (de la 0 a hasta-1) bajan un píxel.
//  La fila "hasta" original queda tapada y arriba entra una vacía.
//  Lo usamos para el rebote al andar y para respirar: con mover
//  medio cuerpo un solo píxel, el sprite parece vivo.
// -------------------------------------------------------------
function bajarFilas(matriz, hasta) {
  const vacia = ".".repeat(ANCHO_SPRITE);
  return [vacia, ...matriz.slice(0, hasta), ...matriz.slice(hasta + 1)];
}


// -------------------------------------------------------------
//  crearSprite(): convierte una matriz de caracteres en un canvas.
//  Además comprueba que la matriz esté bien hecha: es fácil
//  equivocarse al escribir una fila a mano y esto avisa en la consola.
// -------------------------------------------------------------
function crearSprite(nombre, matriz) {
  if (matriz.length !== ALTO_SPRITE) {
    console.warn(`Sprite "${nombre}": tiene ${matriz.length} filas y deberían ser ${ALTO_SPRITE}`);
  }

  const lienzo = document.createElement("canvas");
  lienzo.width = ANCHO_SPRITE;
  lienzo.height = ALTO_SPRITE;
  const ctx = lienzo.getContext("2d");

  matriz.forEach((fila, y) => {
    if (fila.length !== ANCHO_SPRITE) {
      console.warn(`Sprite "${nombre}": la fila ${y} mide ${fila.length} y debería medir ${ANCHO_SPRITE}`);
    }
    for (let x = 0; x < fila.length; x++) {
      const letra = fila[x];
      if (letra === ".") continue;                 // transparente
      const color = COLORES_PERSONAJE[letra];
      if (!color) {
        console.warn(`Sprite "${nombre}": letra desconocida "${letra}" en (${x}, ${y})`);
        continue;
      }
      rect(ctx, color, x, y, 1, 1);
    }
  });

  return lienzo;
}


// --- Montaje de todos los fotogramas ---
// Une las tres piezas del sprite de lado
function montarLado(torso, piernas) {
  return [...CABEZA_LADO, ...torso, ...piernas];
}

const FILAS_CUERPO = 30;      // de la 0 a la 29: cabeza y torso
const FILAS_HOMBROS = 16;     // de la 0 a la 15: cabeza y hombros

const QUIETO_LADO = montarLado(TORSO_LADO.centro, PIERNAS_LADO.quieto);

const SPRITES = {
  espalda: crearSprite("espalda", ESPALDA),
  espaldaRespira: crearSprite("espaldaRespira", bajarFilas(ESPALDA, FILAS_HOMBROS)),
  quieto: crearSprite("quieto", QUIETO_LADO),
  quietoRespira: crearSprite("quietoRespira", bajarFilas(QUIETO_LADO, FILAS_HOMBROS)),

  // Ciclo de andar: en los pasos (piernas abiertas) el cuerpo baja un
  // píxel y en los cruces vuelve a subir. Ese es el "rebote". El brazo
  // va siempre al revés que la pierna cercana.
  andar: [
    crearSprite("andar0", bajarFilas(montarLado(TORSO_LADO.atras, PIERNAS_LADO.pasoA), FILAS_CUERPO)),
    crearSprite("andar1", montarLado(TORSO_LADO.centro, PIERNAS_LADO.cruceA)),
    crearSprite("andar2", bajarFilas(montarLado(TORSO_LADO.delante, PIERNAS_LADO.pasoB), FILAS_CUERPO)),
    crearSprite("andar3", montarLado(TORSO_LADO.centro, PIERNAS_LADO.cruceB)),
  ],
};


// -------------------------------------------------------------
//  Elegir y dibujar el fotograma
// -------------------------------------------------------------

// Qué sprite toca según lo que está haciendo el personaje
function elegirSprite(personaje) {
  if (personaje.estado === "andando") {
    return SPRITES.andar[Math.floor(personaje.fasePaso) % SPRITES.andar.length];
  }
  // Parado: alterna entre las dos posturas para "respirar"
  const respira = Math.floor(personaje.tiempoQuieto / PERIODO_RESPIRAR) % 2 === 1;
  if (personaje.estado === "mirando") return respira ? SPRITES.espaldaRespira : SPRITES.espalda;
  return respira ? SPRITES.quietoRespira : SPRITES.quieto;
}

// Dibuja al personaje con los pies en (x, yPies), en píxeles lógicos de
// pantalla. x puede tener decimales: juego.js la alinea a un píxel FÍSICO
// para que el personaje se mueva con suavidad (ver dibujar()).
function dibujarPersonaje(ctx, personaje, x, yPies) {
  dibujarSombra(ctx, x, yPies);

  const sprite = elegirSprite(personaje);
  const arriba = yPies - ALTO_SPRITE;

  // Mirando a la izquierda usamos el mismo sprite volteado. De
  // espaldas no hace falta: mira al cuadro, ni a un lado ni a otro.
  const voltear = personaje.estado !== "mirando" && personaje.direccion < 0;
  if (voltear) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(-1, 1);   // espejo horizontal alrededor de x
    ctx.drawImage(sprite, -ANCHO_SPRITE / 2, arriba);
    ctx.restore();
  } else {
    ctx.drawImage(sprite, x - ANCHO_SPRITE / 2, arriba);
  }
}

// Sombra a los pies: una franja oscura con los extremos "a cuadros"
// (dithering al 50 %) para que parezca más suave.
function dibujarSombra(ctx, x, yPies) {
  rect(ctx, PALETA.sueloSombra, x - 6, yPies - 1, 12, 2);
  for (const dx of [-8, -7, 6, 7]) {
    for (const dy of [-1, 0]) {
      if ((dx + dy) % 2 === 0) rect(ctx, PALETA.sueloSombra, x + dx, yPies + dy, 1, 1);
    }
  }
}
