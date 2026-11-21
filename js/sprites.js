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
//
//  Proporciones (filas): cabeza 0–8, cuello 9, cuello de la camisa
//  10, torso 11–25 (hasta el bajo de la chaqueta), piernas 26–41 y
//  zapatos 42–43.
// =============================================================


// --- Medidas y tiempos de la animación ---
const ANCHO_SPRITE = 16;
const ALTO_SPRITE = 44;
const LONGITUD_FOTOGRAMA = 5;  // píxeles que avanza el personaje en cada fotograma al andar
const FASE_AL_ARRANCAR = 2;    // fotograma con el que empieza a andar (piernas casi juntas)
const RETRASO_GIRO = 0.25;     // segundos quieto delante de un cuadro antes de girarse
const PERIODO_RESPIRAR = 1.4;  // segundos entre "inspirar" y "espirar" cuando está parado


// --- Qué color es cada letra ---
// La luz viene de los focos del techo: lo que mira hacia arriba o
// hacia delante es más claro. La pierna y el brazo del fondo son más
// oscuros (están en sombra), pero llevan un borde algo más claro para
// que se lean como una pierna y no como una mancha.
const COLORES_PERSONAJE = {
  H: "#3A2416",        // pelo oscuro
  h: "#5C3B26",        // pelo
  c: "#8A5D3B",        // rizos
  C: "#B07F55",        // brillo de los rizos
  S: "#D9A982",        // piel
  s: "#A9744F",        // piel en sombra (oreja, cuello, mandíbula)
  W: PALETA.blanco,    // camisa
  w: "#BFC3C0",        // camisa en sombra
  T: PALETA.carbon,    // traje
  t: PALETA.grafito,   // traje iluminado
  u: PALETA.humo,      // brillo del traje (hombros, brazo)
  K: PALETA.negro,     // sombras: pierna y brazo del fondo, costuras
  Z: "#2B1D16",        // zapatos (piel marrón oscura, para no confundirse con el pantalón)
  z: "#5A3E2B",        // brillo de los zapatos
  A: PALETA.azul,      // un píxel azul "glitch", como en la referencia
};


// =============================================================
//  De espaldas (mirando un cuadro). Es casi simétrico.
// =============================================================
const ESPALDA = [
  "......hHHh......",   //  0  pelo rizado
  "....hcHhHcHh....",
  "....HhcHHhcH....",
  "...hHcHhcHHch...",
  "...cHhHCHhHcH...",
  "...sHHhHHcHHs...",   //  5  orejas
  "...shHcHhHHhA...",   //     (con un píxel azul "glitch" en una oreja)
  "....HhHHcHhH....",
  ".....hHhHHh.....",   //     nuca
  "......sSSs......",   //     cuello
  ".....wWWWWw.....",   // 10  cuello de la camisa
  "...tuuuuuuuut...",   //     hombros, iluminados desde arriba
  "..tuTTTTTTTTut..",
  "..tTTTTTTTTTTt..",
  "..tTKTTTTTTKTt..",   //     brazos, separados del cuerpo por una costura oscura
  "..tTKTTTTTTKTt..",   // 15
  "..tTKTTTTTTKTt..",
  "..tTKTTTTTTKTt..",
  "..tTKTTTTTTKTt..",
  "..tTKTTTTTTKTt..",
  "..tTKTTTTTTKTt..",   // 20
  "..tTKTTTTTTKTt..",
  "..tTKTTTKTTKTt..",   //     abertura de la chaqueta
  "..sSKTTTKKTKSs..",   //     manos
  "..sSKTTTKKTKSs..",
  "....KTTTKKTK....",   // 25  bajo de la chaqueta
  "....tTTTTTTt....",   //     pantalón
  "....tTTTTTTt....",
  "....tTTKKTTt....",
  "....tTK..KTt....",   //     dos piernas, un poco separadas
  "....tTK..KTt....",   // 30
  "....tTK..KTt....",
  "....tTK..KTt....",
  "....tTK..KTt....",
  "....tTK..KTt....",
  "....tTK..KTt....",   // 35
  "....tTK..KTt....",
  "....tTK..KTt....",
  "....tTK..KTt....",
  "....tTK..KTt....",
  "....tTK..KTt....",   // 40
  "....tTK..KTt....",
  "....zZZ..ZZz....",   //     talones de los zapatos
  "...ZZZZ..ZZZZ...",
];


// =============================================================
//  De lado (mirando a la derecha). Para no repetir lo que no
//  cambia, el sprite se monta con tres piezas: cabeza (filas
//  0–10), torso con el brazo (11–25) y piernas (26–43).
// =============================================================

const CABEZA_LADO = [
  "......hHHh......",   //  0
  "....hcHhHcHh....",
  "...hHcHhcHHch...",
  "...cHhHCHhHcch..",   //     un rizo cae sobre la frente
  "...hHHcHhSSSS...",
  "...hHcHhsSSKS...",   //  5  oreja (s) y ojo (K)
  "...HhHhHsSSSSS..",   //     nariz: un solo píxel
  "....hHhHSSSSs...",   //     boca en sombra
  ".....HhHsSSs....",   //     mandíbula
  ".......sSs......",   //     cuello
  "......tTtWW.....",   // 10  cuello de la camisa
];

// El brazo cercano se balancea: hacia atrás, en el centro o hacia
// delante. Cuando va atrás, asoma por delante la mano del brazo del
// fondo, y al revés (los brazos van siempre en sentidos opuestos).
const TORSO_LADO = {
  centro: [
    "....tuuuutWW....",   // 11  hombro iluminado
    "....TKuutTWw....",
    "....TKtutTTw....",
    "....TKtutTTT....",
    "....TKtutTTT....",   // 15
    "....TKtutTTT....",
    "....TKtutTTT....",
    "....TTKtuTTT....",   //     codo
    "....TTKtuTT.....",
    "....TTKtuTT.....",   // 20
    "....TTKtuTT.....",
    "....TTKtuTT.....",
    "....TTKSsTT.....",   //     mano
    "....TTTSsTT.....",
    "....KTTTTTK.....",   // 25  bajo de la chaqueta
  ],
  delante: [
    "....tuuuutWW....",
    "....TKuutTWw....",
    "....TKtuuTTw....",
    "....TTKtuuTT....",
    "....TTKtuuTT....",
    "....TTTKtuuT....",
    "....TTTKtuuT....",
    "....TTTTKtuu....",
    "....TTTTTKtu....",
    "....TTTTTTKtu...",
    "...KTTTTTTT.tu..",   //     asoma la manga del brazo del fondo
    "..sKTTTTTTT.Ss..",   //     mano cercana (delante) y la del fondo (detrás)
    "..s.TTTTTTT.Ss..",
    "....TTTTTTT.....",
    "....KTTTTTK.....",
  ],
  atras: [
    "....tuuuutWW....",
    "....TuutKTWw....",
    "....uutKTTTw....",
    "...uutKTTTTT....",
    "...utKTTTTTT....",
    "..uutTTTTTTT....",
    "..utKTTTTTTT....",
    ".utKTTTTTTTT....",
    ".ut.TTTTTTTK....",
    ".ut.TTTTTTTKs...",   //     asoma la mano del brazo del fondo
    ".Ss.TTTTTTT.s...",   //     mano cercana (detrás)
    ".Ss.TTTTTTT.....",
    "....TTTTTTT.....",
    "....TTTTTTT.....",
    "....KTTTTTK.....",
  ],
};

// Piernas. La cercana es "T" con el borde delantero "t" (iluminado);
// la del fondo es "K" con el borde delantero "T". Se dibuja primero
// la del fondo y encima la cercana, como pasaría de verdad.
//
// Un paso completo tiene seis posturas (las de los dibujos animados
// clásicos). Para cada pierna:
//   contacto → el talón de delante toca el suelo, piernas abiertas
//   apoyo    → el pie apoya plano, el cuerpo baja, la otra se levanta
//   paso     → la pierna que avanza pasa por debajo, rodilla delante
const PIERNAS_LADO = {
  quieto: [
    ".....KTTTTt.....",   // 26  cadera
    ".....KTTTTt.....",
    ".....KTTTt......",
    ".....KTTTt......",
    ".....KTTTt......",   // 30
    ".....KTTTt......",
    ".....KTTTt......",
    ".....KTTTt......",
    ".....KTTTt......",
    ".....KTTTt......",   // 35
    ".....KTTTt......",
    ".....KTTTt......",
    ".....KTTTt......",
    ".....KTTTt......",
    ".....KTTTt......",   // 40
    ".....KTTTt......",
    ".....ZZZZZz.....",   //     zapato, con brillo en la punta
    ".....ZZZZZZz....",
  ],
  // 1. Contacto: la cercana delante (el talón toca, la punta aún
  //    levantada) y la del fondo detrás, despegando con la punta
  contactoA: [
    ".....KTTTTt.....",
    ".....KTTTt......",
    "....KKTTTTt.....",
    "....KKTTTTt.....",
    "....KKTTTTt.....",   // 30
    "...KKT..TTt.....",
    "...KKT..TTt.....",
    "...KKT..TTTt....",
    "..KKT....TTt....",   //     rodillas
    "..KKT....TTt....",   // 35
    "..KKT....TTt....",
    "..KKT.....TTt...",
    ".KKT......TTt...",
    ".KKT......TTt...",
    ".KKT......TTt...",   // 40
    ".KKT......TTt...",
    ".ZZZZ.....ZZZZz.",   //     el pie cercano apoya el talón…
    "...ZZZ....ZZZ...",   //     …y la punta aún no toca el suelo
  ],
  // 2. Apoyo: el pie cercano plano; el del fondo ya se ha levantado
  apoyoA: [
    ".....KTTTTt.....",
    ".....KTTTt......",
    "....KKTTTTt.....",
    "....KKTTTTt.....",
    "....KKTTTTt.....",   // 30
    "...KKT..TTt.....",
    "...KKT..TTt.....",
    "...KKT..TTt.....",
    "...KKT..TTt.....",
    "..KKT...TTt.....",   // 35
    "..KKT...TTt.....",
    ".KKT....TTt.....",
    ".KKT....TTt.....",
    ".KKT....TTt.....",
    "ZZZZ....TTt.....",   // 40  pie del fondo en el aire
    ".ZZZ....TTt.....",
    "........ZZZZz...",
    "........ZZZZZZ..",
  ],
  // 3. Paso: la cercana, recta, sostiene el cuerpo; la del fondo pasa
  //    por debajo con la rodilla adelantada y el pie recogido
  pasoA: [
    ".....KTTTTt.....",
    ".....KTTTt......",
    "......TTTt......",
    "......TTTt......",
    "......TTTtT.....",   // 30
    "......TTTtKT....",   //     rodilla del fondo, asomando por delante
    "......TTTtKT....",
    "......TTTtT.....",
    "......TTTt......",
    "......TTTt......",   // 35
    "......TTTt......",
    ".....KTTTt......",
    "....KKTTTt......",
    "...ZZZTTTt......",   //     pie del fondo, recogido detrás
    "....ZZTTTt......",   // 40
    "......TTTt......",
    "......ZZZZz.....",
    "......ZZZZZZ....",
  ],
  // 4–6. Lo mismo con las piernas cambiadas: ahora va delante la del
  //      fondo y es la cercana la que despega, se levanta y pasa
  contactoB: [
    ".....TTTtKT.....",
    ".....TTtKT......",
    "....TTtKKKT.....",
    "....TTtKKKT.....",
    "....TTtKKKT.....",   // 30
    "...TTt..KKT.....",
    "...TTt..KKT.....",
    "...TTt..KKKT....",
    "..TTt....KKT....",
    "..TTt....KKT....",   // 35
    "..TTt....KKT....",
    "..TTt.....KKT...",
    ".TTt......KKT...",
    ".TTt......KKT...",
    ".TTt......KKT...",   // 40
    ".TTt......KKT...",
    ".ZZZz.....ZZZZZ.",
    "...ZZZ....ZZZ...",
  ],
  apoyoB: [
    ".....TTTtKT.....",
    ".....TTtKT......",
    "....TTtKKKT.....",
    "....TTtKKKT.....",
    "....TTtKKKT.....",   // 30
    "...TTt..KKT.....",
    "...TTt..KKT.....",
    "...TTt..KKT.....",
    "...TTt..KKT.....",
    "..TTt...KKT.....",   // 35
    "..TTt...KKT.....",
    ".TTt....KKT.....",
    ".TTt....KKT.....",
    ".TTt....KKT.....",
    "ZZZz....KKT.....",   // 40  pie cercano en el aire
    ".ZZZ....KKT.....",
    "........ZZZZZ...",
    "........ZZZZZZ..",
  ],
  pasoB: [
    ".....KTTTTt.....",
    ".....KTTTt......",
    "......KTTt......",
    "......KKTTt.....",
    "......KKKTTt....",   // 30
    "......KKKTTt....",   //     rodilla cercana, por delante
    "......KKKTTt....",
    "......KKKTTt....",
    "......KKTTt.....",
    "......KTTt......",   // 35
    "......TTtT......",
    ".....TTtKT......",
    "....TTtKKT......",
    "...ZZZzKKT......",   //     pie cercano, recogido detrás
    "....ZZKKKT......",   // 40
    "......KKKT......",
    "......ZZZZZ.....",
    "......ZZZZZZ....",
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

const FILAS_CUERPO = 26;      // de la 0 a la 25: cabeza y torso
const FILAS_HOMBROS = 13;     // de la 0 a la 12: cabeza y hombros

const QUIETO_LADO = montarLado(TORSO_LADO.centro, PIERNAS_LADO.quieto);

const SPRITES = {
  espalda: crearSprite("espalda", ESPALDA),
  espaldaRespira: crearSprite("espaldaRespira", bajarFilas(ESPALDA, FILAS_HOMBROS)),
  quieto: crearSprite("quieto", QUIETO_LADO),
  quietoRespira: crearSprite("quietoRespira", bajarFilas(QUIETO_LADO, FILAS_HOMBROS)),

  // Ciclo de andar en seis fotogramas. En el apoyo el cuerpo baja un
  // píxel (carga el peso) y en los demás vuelve a subir: ese es el
  // "rebote". El brazo cercano va siempre al revés que la pierna cercana.
  andar: [
    crearSprite("contactoA", montarLado(TORSO_LADO.atras, PIERNAS_LADO.contactoA)),
    crearSprite("apoyoA", bajarFilas(montarLado(TORSO_LADO.atras, PIERNAS_LADO.apoyoA), FILAS_CUERPO)),
    crearSprite("pasoA", montarLado(TORSO_LADO.centro, PIERNAS_LADO.pasoA)),
    crearSprite("contactoB", montarLado(TORSO_LADO.delante, PIERNAS_LADO.contactoB)),
    crearSprite("apoyoB", bajarFilas(montarLado(TORSO_LADO.delante, PIERNAS_LADO.apoyoB), FILAS_CUERPO)),
    crearSprite("pasoB", montarLado(TORSO_LADO.centro, PIERNAS_LADO.pasoB)),
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
