// =============================================================
//  museo.js — el plano del museo, su entorno pixelado y los cuadros
// -------------------------------------------------------------
//  Todo se mide en "píxeles lógicos" (1 píxel lógico = varios
//  píxeles de pantalla). El eje X recorre el pasillo de izquierda a
//  derecha; el eje Y va de arriba (techo) a abajo (suelo).
//
//  El museo se pinta en tres capas, de atrás hacia delante:
//    1. ENTORNO: pared, suelo, techo, focos, puertas y bancos. Un
//       canvas pequeño por sala, generado UNA sola vez con dithering
//       y ampliado con image-rendering: pixelated.
//    2. CUADROS, RÓTULOS y CARTELAS: elementos HTML encima, colocados
//       con las mismas coordenadas lógicas.
//    3. PERSONAJE: otro canvas por delante (lo pinta juego.js).
//
//  Las capas 1 y 2 viven dentro de #mundo, un contenedor que la
//  cámara desplaza entero con un transform de CSS. Mover la cámara
//  cuesta lo mismo que mover un único elemento.
// =============================================================


// --- Medidas del museo, en píxeles lógicos ---
const MEDIDAS = {
  // Vertical. El techo se pega arriba y el suelo abajo; la pared
  // ocupa lo que queda. Si la ventana es más alta se ve más pared,
  // pero los cuadros quedan siempre a la misma altura sobre el suelo.
  altoMinimo: 160,   // la escala se elige para que haya al menos este alto
  techo: 18,         // franja oscura de arriba
  suelo: 34,         // franja del suelo, abajo
  rodapie: 3,        // tira oscura donde la pared toca el suelo

  // Horizontal: el orden del recorrido, de izquierda a derecha
  entrada: 90,       // pasillo antes de la primera sala
  rotulo: 120,       // espacio para el rótulo al empezar cada sala
  hueco: 104,        // espacio de cada cuadro (cuadro + separación)
  puerta: 56,        // espacio del vano de puerta entre dos salas
  salida: 120,       // pasillo final, con la placa de créditos

  // Cuadros
  cuadroAncho: 78,   // tamaño máximo; cada cuadro se ajusta a su proporción
  cuadroAlto: 60,
  alturaCuadro: 60,  // altura del CENTRO del cuadro sobre la línea del suelo
  marco: 2,          // grosor del marco
  zonaCuadro: 22,    // a menos de esta distancia del centro, estás "delante" del cuadro

  // Personaje
  piesPersonaje: 20, // filas por debajo de la pared donde apoya los pies

  // Rótulos, puertas y bancos
  rotuloAncho: 100,
  puertaAncho: 32,
  puertaAlto: 76,
  bancoAncho: 36,
  cadaCuantosBanco: 6,   // un banco delante de uno de cada seis cuadros
};


// =============================================================
//  1. EL PLANO: dónde va cada cosa a lo largo del eje X
// =============================================================
//  Recorre las salas de datos/obras.js y va avanzando un "cursor"
//  (la variable x) sumando el ancho de cada elemento. El resto del
//  juego (dibujo, cámara, HUD) solo consulta este plano.
function crearPlano() {
  const salas = [];
  const cuadros = [];    // todos los cuadros seguidos, para recorrerlos fácilmente
  const puertas = [];    // X del centro de cada puerta
  const bancos = [];     // X del centro de cada banco
  let x = MEDIDAS.entrada;

  SALAS.forEach((datos, indice) => {
    const sala = {
      indice,
      datos,                               // número, nombre, años, texto, obras
      inicio: x,
      rotuloX: x + MEDIDAS.rotulo / 2,     // centro del rótulo
      cuadros: [],
    };
    x += MEDIDAS.rotulo;

    datos.obras.forEach((obra, i) => {
      const cuadro = {
        obra,
        sala: indice,
        x: x + MEDIDAS.hueco / 2,          // centro del cuadro
        estado: "pendiente",               // pendiente → cargando → cargado | error
      };
      sala.cuadros.push(cuadro);
      cuadros.push(cuadro);
      if (i % MEDIDAS.cadaCuantosBanco === 3) bancos.push(cuadro.x);
      x += MEDIDAS.hueco;
    });

    sala.fin = x;
    salas.push(sala);

    // Entre sala y sala (pero no después de la última) hay una puerta
    if (indice < SALAS.length - 1) {
      puertas.push(x + MEDIDAS.puerta / 2);
      x += MEDIDAS.puerta;
    }
  });

  const finalX = x + MEDIDAS.salida / 2;   // centro de la placa de créditos
  x += MEDIDAS.salida;
  const ancho = x;

  // TRAMOS: el entorno se genera en un canvas por sala. Cada tramo
  // va desde el inicio de su sala hasta el inicio de la siguiente
  // (así incluye la puerta de su derecha). El primero empieza en 0
  // para cubrir la entrada y el último llega hasta el final.
  const tramos = salas.map((sala, i) => ({
    inicio: i === 0 ? 0 : sala.inicio,
    fin: i < salas.length - 1 ? salas[i + 1].inicio : ancho,
    altoGenerado: 0,     // alto con el que se generó (0 = aún no)
    lienzo: null,        // el <canvas>; lo crea construirMuseo()
  }));

  // FOCOS: uno sobre cada rótulo, cada cuadro y la placa final
  const focos = [...salas.map((s) => s.rotuloX), ...cuadros.map((c) => c.x), finalX]
    .sort((a, b) => a - b);

  return { salas, cuadros, puertas, bancos, tramos, focos, finalX, ancho };
}


// Devuelve el cuadro que hay delante de la posición x, o null si no hay ninguno
function cuadroEnPosicion(plano, x) {
  for (const cuadro of plano.cuadros) {
    if (Math.abs(cuadro.x - x) <= MEDIDAS.zonaCuadro) return cuadro;
  }
  return null;
}


// Devuelve el índice (0–5) de la sala en la que está la posición x.
// Es la última sala cuyo inicio queda a la izquierda de x.
function salaEnPosicion(plano, x) {
  let indice = 0;
  for (const sala of plano.salas) {
    if (x >= sala.inicio) indice = sala.indice;
  }
  return indice;
}


// =============================================================
//  2. EL ENTORNO PIXELADO
// =============================================================
//  Para cada píxel calculamos un BRILLO (un número de 0 a 1) a
//  partir de varias "capas" sumadas: el tono base del material,
//  sombras, la luz de los focos y un poco de grano. Después,
//  colorDitherizado() convierte ese brillo en un color de la
//  paleta usando la matriz de Bayer.
// =============================================================

// Filas del suelo donde hay una junta entre tablas. Cada vez están
// más separadas hacia abajo (hacia nosotros): así el suelo parece
// tener profundidad, como en una perspectiva.
const JUNTAS_SUELO = [4, 9, 15, 22, 30];

// Para cada fila del suelo: -1 si es una junta, o el número de tabla
const TABLA_DE_FILA = (() => {
  const filas = [];
  let tabla = 0;
  for (let fila = 0; fila < MEDIDAS.suelo; fila++) {
    if (JUNTAS_SUELO.includes(fila)) {
      filas.push(-1);
      tabla++;
    } else {
      filas.push(tabla);
    }
  }
  return filas;
})();


// -------------------------------------------------------------
//  generarTramo(): pinta el entorno de un tramo en su canvas.
//  Se llama cuando el tramo se acerca a la cámara, y otra vez si
//  cambia el alto de la ventana (porque cambia la altura de la pared).
// -------------------------------------------------------------
function generarTramo(plano, tramo, alto) {
  const ancho = tramo.fin - tramo.inicio;
  const lienzo = tramo.lienzo;
  lienzo.width = ancho;      // cambiar el tamaño también borra el canvas
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");

  // Alturas que dependen del alto de la ventana
  const ySuelo = alto - MEDIDAS.suelo;
  const e = {
    alto,
    ySuelo,                                  // primera fila del suelo
    yRodapie: ySuelo - MEDIDAS.rodapie,      // primera fila del rodapié
    yPuerta: ySuelo - MEDIDAS.puertaAlto,    // dintel de las puertas
    altoPared: ySuelo - MEDIDAS.techo,
  };

  // Precálculo por columnas: la distancia al foco y a la puerta más
  // cercanos no depende de la fila, así que la calculamos una vez por
  // columna y no una vez por píxel (cientos de veces menos trabajo).
  const focos = plano.focos.filter((f) => f > tramo.inicio - 200 && f < tramo.fin + 200);
  const puertas = plano.puertas.filter((p) => p > tramo.inicio - 50 && p < tramo.fin + 50);
  const distanciaFoco = new Float32Array(ancho);
  const distanciaPuerta = new Float32Array(ancho);
  for (let x = 0; x < ancho; x++) {
    distanciaFoco[x] = distanciaMinima(tramo.inicio + x, focos);
    distanciaPuerta[x] = distanciaMinima(tramo.inicio + x, puertas);
  }

  // Recorremos todos los píxeles y escribimos su color directamente
  // en un ImageData: un array con 4 números por píxel (R, G, B, A).
  const imagen = ctx.createImageData(ancho, alto);
  const pixeles = imagen.data;
  let i = 0;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      // Usamos la X del MUNDO (no la del tramo) para el dithering y el
      // ruido: así la trama continúa sin cortes entre un tramo y otro.
      const color = colorEntorno(tramo.inicio + x, y, distanciaFoco[x], distanciaPuerta[x], e);
      pixeles[i] = color[0];
      pixeles[i + 1] = color[1];
      pixeles[i + 2] = color[2];
      pixeles[i + 3] = 255;   // opaco
      i += 4;
    }
  }
  ctx.putImageData(imagen, 0, 0);

  // Detalles pequeños y nítidos, dibujados encima con rectángulos
  for (const f of focos) dibujarFoco(ctx, f - tramo.inicio);
  for (const b of plano.bancos) {
    if (b > tramo.inicio && b < tramo.fin) dibujarBanco(ctx, b - tramo.inicio, ySuelo);
  }

  tramo.altoGenerado = alto;
}

function distanciaMinima(x, lista) {
  let minima = Infinity;
  for (const valor of lista) minima = Math.min(minima, Math.abs(x - valor));
  return minima;
}


// Decide qué hay en el píxel (x, y) y devuelve su color [r, g, b]
function colorEntorno(x, y, dFoco, dPuerta, e) {
  // 1. Píxeles azules "glitch" en el horizonte y en los bordes
  const glitch = colorGlitch(x, y, dPuerta, e);
  if (glitch) return glitch;

  // 2. Techo
  if (y < MEDIDAS.techo) return colorTecho(x, y);

  // 3. Puerta: el vano oscuro y su marco cortan la pared y el rodapié
  const mitadPuerta = MEDIDAS.puertaAncho / 2;
  if (y < e.ySuelo && y >= e.yPuerta - 2 && dPuerta < mitadPuerta + 2) {
    if (dPuerta < mitadPuerta && y >= e.yPuerta) return colorVano(x, y, e);
    return colorDitherizado(RAMPAS.negro, 0.72, x, y);   // marco
  }

  // 4. Pared y rodapié
  if (y < e.yRodapie) return colorPared(x, y, dFoco, e);
  if (y < e.ySuelo) return colorDitherizado(RAMPAS.negro, y === e.yRodapie ? 0.9 : 0.5, x, y);

  // 5. Suelo
  return colorSuelo(x, y, dFoco, dPuerta, e);
}


function colorTecho(x, y) {
  const T = MEDIDAS.techo;
  const t = y / (T - 1);                 // 0 arriba, 1 junto a la pared
  let brillo = 0.05 + 0.3 * t * t;       // se aclara al acercarse a la pared
  if (y === T - 7) brillo = 0.6;         // carril del que cuelgan los focos
  else if (y === T - 1) brillo = 0.55;   // moldura
  else if (y < T - 7 && x % 48 === 0) brillo += 0.2;   // juntas entre paneles
  brillo += (ruido(x, y) - 0.5) * 0.1;   // grano
  return colorDitherizado(RAMPAS.negro, brillo, x, y);
}


function colorPared(x, y, dFoco, e) {
  const profundidad = y - MEDIDAS.techo;   // píxeles por debajo del techo
  let brillo = 0.46;                                   // tono base: el verde azulado medio
  brillo -= 0.2 * Math.max(0, 1 - profundidad / 16);   // sombra bajo el techo
  brillo += luzDeFoco(dFoco, profundidad, e.altoPared); // cono de luz
  brillo += (ruido(x, y) - 0.5) * 0.1;                 // grano de "foto"
  // Alguna mota oscura suelta, como el grano de la imagen de referencia
  if (ruido(x + 7000, y + 7000) < 0.003) return RAMPAS.pared[0];
  return colorDitherizado(RAMPAS.pared, brillo, x, y);
}


// Cono de luz de un foco: estrecho arriba, se abre al bajar y pierde
// fuerza con la distancia. "distancia" es lo lejos que está la columna
// del eje del foco y "profundidad" lo que ha bajado desde el techo.
function luzDeFoco(distancia, profundidad, alcance) {
  const mitad = 3 + profundidad * 0.45;    // medio ancho del cono a esa altura
  if (distancia >= mitad) return 0;
  const borde = 1 - distancia / mitad;     // 1 en el centro, 0 en el borde
  const caida = Math.max(0, 1 - profundidad / (alcance * 1.5));
  return 0.45 * Math.sqrt(borde) * caida;
}


// Interior oscuro de la puerta: negro arriba y un poco más claro abajo,
// donde asoma el suelo de la sala siguiente.
function colorVano(x, y, e) {
  const t = (y - e.yPuerta) / MEDIDAS.puertaAlto;   // 0 arriba, 1 abajo
  let brillo = 0.04 + 0.55 * t * t * t;
  brillo += (ruido(x, y) - 0.5) * 0.08;
  return colorDitherizado(RAMPAS.negro, brillo, x, y);
}


function colorSuelo(x, y, dFoco, dPuerta, e) {
  const fila = y - e.ySuelo;   // 0 junto a la pared, aumenta hacia nosotros

  // Umbral oscuro delante de cada puerta
  if (fila < 2 && dPuerta < MEDIDAS.puertaAncho / 2 + 2) {
    return colorDitherizado(RAMPAS.negro, 0.55, x, y);
  }

  let brillo = 0.56 - 0.18 * (fila / MEDIDAS.suelo);   // más oscuro cerca de nosotros
  if (fila === 0) brillo -= 0.18;                       // sombra al pie de la pared

  // Tablas: juntas horizontales y, dentro de cada tabla, juntas
  // verticales cada vez más separadas (otra vez, perspectiva)
  const tabla = TABLA_DE_FILA[fila];
  if (tabla === -1) {
    brillo -= 0.22;
  } else {
    const largo = 30 + tabla * 12;
    if ((x + tabla * 37) % largo === 0) brillo -= 0.2;
  }

  // Charco de luz de cada foco: una elipse cerca de la pared
  const nx = dFoco / 36;
  const ny = (fila - 5) / 11;
  const r = nx * nx + ny * ny;
  if (r < 1) brillo += 0.22 * (1 - r);

  brillo += (ruido(x, y) - 0.5) * 0.08;
  return colorDitherizado(RAMPAS.suelo, brillo, x, y);
}


// Píxeles azules sueltos, como en el horizonte de la referencia.
// Devuelve un azul o null si en este píxel no toca.
function colorGlitch(x, y, dPuerta, e) {
  let probabilidad = 0;

  const centroHorizonte = e.yRodapie + 1;
  const distanciaHorizonte = Math.abs(y - centroHorizonte);
  if (distanciaHorizonte <= 3) {
    probabilidad = 0.45 * (1 - distanciaHorizonte / 4.5);   // horizonte: pared contra suelo
  } else if (y === MEDIDAS.techo || y === MEDIDAS.techo - 1) {
    probabilidad = 0.15;                                   // borde del techo
  } else if (y >= e.alto - 3) {
    probabilidad = 0.35;                                   // borde de abajo, junto al panel
  }

  // Bordes del vano de la puerta (laterales y dintel)
  const mitad = MEDIDAS.puertaAncho / 2;
  if (y < e.ySuelo && y >= e.yPuerta - 3 && dPuerta <= mitad + 2) {
    const enLateral = dPuerta >= mitad - 1;
    const enDintel = y <= e.yPuerta;
    if (enLateral || enDintel) probabilidad = Math.max(probabilidad, 0.22);
  }

  if (probabilidad === 0) return null;

  // Los píxeles azules van en grupos: hay tramos con muchos y tramos
  // casi sin ninguno, según un ruido suave a lo largo del eje X.
  if (ruidoSuave(x / 9) < 0.5) probabilidad *= 0.15;
  if (ruido(x, y + 5000) >= probabilidad) return null;
  return ruido(x + 3000, y) < 0.75 ? AZULES.azul : AZULES.claro;
}


// Foco colgado del carril del techo, con la lente encendida
function dibujarFoco(ctx, x) {
  const T = MEDIDAS.techo;
  rect(ctx, PALETA.humo, x, T - 6, 1, 2);          // varilla
  rect(ctx, PALETA.grafito, x - 2, T - 4, 5, 3);   // carcasa
  rect(ctx, PALETA.humo, x - 2, T - 4, 5, 1);      // brillo de la carcasa
  rect(ctx, PALETA.paredLuz, x - 1, T - 1, 3, 1);  // lente
  rect(ctx, PALETA.blanco, x, T - 1, 1, 1);
}


// Banco visto de frente, a media profundidad en el suelo
// (el personaje camina por delante de él)
function dibujarBanco(ctx, x, ySuelo) {
  const ancho = MEDIDAS.bancoAncho;
  const izquierda = x - ancho / 2;
  rect(ctx, PALETA.sueloOscuro, izquierda - 2, ySuelo + 12, ancho + 4, 2);   // sombra
  rect(ctx, PALETA.negro, izquierda + 2, ySuelo + 8, 2, 5);                  // pata izquierda
  rect(ctx, PALETA.negro, izquierda + ancho - 4, ySuelo + 8, 2, 5);          // pata derecha
  rect(ctx, PALETA.grafito, izquierda, ySuelo + 4, ancho, 2);                // asiento (arriba)
  rect(ctx, PALETA.humo, izquierda, ySuelo + 4, ancho, 1);                   // brillo
  rect(ctx, PALETA.carbon, izquierda, ySuelo + 6, ancho, 2);                 // canto
}


// =============================================================
//  3. CUADROS, RÓTULOS Y CARTELAS (elementos HTML)
// =============================================================
//  Se posicionan con variables CSS en píxeles lógicos (--izq,
//  --abajo, --w, --h…). El CSS las multiplica por --px, el tamaño
//  de un píxel lógico en la pantalla. Al cambiar la ventana solo
//  hay que actualizar --px y todo se recoloca solo.
// =============================================================

// Atajo para crear un elemento con clase y texto. Usamos textContent
// (y no innerHTML) para que el texto nunca se interprete como HTML.
function crearElemento(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}


// Crea todos los elementos del museo dentro de #mundo
function construirMuseo(plano, mundo) {
  mundo.style.setProperty("--ancho-mundo", plano.ancho);
  mundo.style.setProperty("--marco", MEDIDAS.marco);
  mundo.style.setProperty("--ancho-rotulo", MEDIDAS.rotuloAncho);

  // 1. Un canvas por tramo de entorno (vacíos: se generan al acercarse)
  for (const tramo of plano.tramos) {
    tramo.lienzo = crearElemento("canvas", "tramo");
    tramo.lienzo.style.setProperty("--x", tramo.inicio);
    tramo.lienzo.style.setProperty("--ancho", tramo.fin - tramo.inicio);
    mundo.append(tramo.lienzo);
  }

  // 2. Rótulo de cada sala y sus cuadros
  for (const sala of plano.salas) {
    const { numero, nombre, años, texto } = sala.datos;
    mundo.append(crearRotulo(sala.rotuloX, { numero, nombre, anios: años, texto }));
    for (const cuadro of sala.cuadros) mundo.append(crearCuadro(cuadro));
  }

  // 3. Placa final con los créditos
  mundo.append(crearRotulo(plano.finalX, {
    nombre: "Fin del recorrido",
    texto: "Imágenes: The Metropolitan Museum of Art, Open Access (CC0).",
  }, "rotulo--final"));
}


// Rótulo de sala pintado en la pared: número romano, nombre, años y texto
function crearRotulo(x, { numero, nombre, anios, texto }, claseExtra) {
  const rotulo = crearElemento("article", "rotulo");
  if (claseExtra) rotulo.classList.add(claseExtra);
  rotulo.style.setProperty("--izq", x - MEDIDAS.rotuloAncho / 2);
  // El borde de arriba del rótulo, alineado con el de los cuadros más altos
  rotulo.style.setProperty("--arriba", MEDIDAS.suelo + MEDIDAS.alturaCuadro + MEDIDAS.cuadroAlto / 2);

  if (numero) rotulo.append(crearElemento("p", "rotulo__numero", numero));
  rotulo.append(crearElemento("h2", "rotulo__nombre", nombre));
  if (anios) rotulo.append(crearElemento("p", "rotulo__anios", anios));
  rotulo.append(crearElemento("p", "rotulo__texto", texto));
  return rotulo;
}


// Cuadro: un marco con la imagen dentro y la cartela debajo
function crearCuadro(cuadro) {
  const { obra } = cuadro;

  const figura = crearElemento("figure", "cuadro");
  const lienzo = crearElemento("div", "cuadro__lienzo");
  const img = crearElemento("img", "cuadro__imagen");
  img.alt = `${obra.titulo}, de ${obra.artista}`;
  img.decoding = "async";
  img.draggable = false;
  lienzo.append(img);

  const cartela = crearElemento("figcaption", "cartela");
  cartela.append(
    crearElemento("span", "cartela__titulo", obra.titulo),
    crearElemento("span", "cartela__autor", `${obra.artista} · ${obra.fecha}`),
  );

  figura.append(lienzo, cartela);
  cuadro.elemento = figura;
  cuadro.img = img;

  // Tamaño provisional hasta que la imagen cargue y sepamos su proporción
  colocarCuadro(cuadro, 46, MEDIDAS.cuadroAlto);
  return figura;
}


// Coloca el cuadro centrado en su X y a la altura de los ojos.
// Redondeamos a píxeles lógicos enteros para que el marco quede nítido.
function colocarCuadro(cuadro, ancho, alto) {
  const estilo = cuadro.elemento.style;
  estilo.setProperty("--w", ancho);
  estilo.setProperty("--h", alto);
  estilo.setProperty("--izq", cuadro.x - Math.floor(ancho / 2) - MEDIDAS.marco);
  estilo.setProperty("--abajo", MEDIDAS.suelo + MEDIDAS.alturaCuadro - Math.floor(alto / 2) - MEDIDAS.marco);
}


// Encaja la imagen en el tamaño máximo sin deformarla.
// Devuelve el tamaño elegido, en píxeles lógicos.
function ajustarAProporcion(cuadro, anchoNatural, altoNatural) {
  const proporcion = anchoNatural / altoNatural;
  let ancho = MEDIDAS.cuadroAncho;
  let alto = Math.round(ancho / proporcion);
  if (alto > MEDIDAS.cuadroAlto) {
    alto = MEDIDAS.cuadroAlto;
    ancho = Math.round(alto * proporcion);
  }
  colocarCuadro(cuadro, ancho, alto);
  return { ancho, alto };
}


// -------------------------------------------------------------
//  Carga de la imagen de un cuadro.
//  crossOrigin = "anonymous" pide la imagen con CORS: el servidor del
//  Met responde con permiso y así podemos leer sus píxeles para
//  pixelarla (ver ditherizarImagen en dither.js). Plan B: si falla, la pedimos sin CORS
//  (se verá, pero no podremos leer los píxeles).
//
//  OJO: el CDN del Met guarda en su caché la versión "normal" de cada
//  imagen SIN la cabecera de CORS (su propia web la pide sin CORS), y
//  el navegador la rechaza. Si añadimos un parámetro a la URL, el CDN
//  la trata como otra entrada de caché y sí la envía con la cabecera.
//  Comprobado el 20/11/2026, también con origen "null" (doble clic).
//
//  REGLA IMPORTANTE: una URL con este parámetro se pide SIEMPRE con
//  CORS. Si alguna vez se pidiera sin CORS (por ejemplo, en una <img>
//  normal), el CDN guardaría esa copia sin cabecera y a partir de ahí
//  fallaría para todo el mundo (lo comprobamos: pasó con dos cuadros
//  cuando el visor reutilizaba esta URL). Por eso el visor usa siempre
//  la URL normal, sin parámetro.
// -------------------------------------------------------------
const PARAMETRO_CORS = "?galeria-cors";

function cargarCuadro(cuadro) {
  cuadro.estado = "cargando";
  const img = cuadro.img;

  // Usamos onload/onerror. (Probamos img.decode(), que descomprime la
  // imagen en otro hilo, pero si el navegador no está pintando
  // fotogramas su promesa puede tardar indefinidamente, y el cuadro no
  // llegaba a cargarse. Lo que ahorraba, unos 2 ms por cuadro, no
  // compensaba ese riesgo.)
  function pedir(url) {
    img.onload = alCargar;
    img.onerror = alFallar;
    img.src = url;
  }

  function alCargar() {
    const { ancho, alto } = ajustarAProporcion(cuadro, img.naturalWidth, img.naturalHeight);

    // Capa pixelada: la imagen reducida a su tamaño en píxeles lógicos
    // y con la paleta del museo. Va DEBAJO de la imagen real, que se
    // irá descubriendo al acercarse (ver actualizarRevelado).
    if (!cuadro.sinCors) {
      try {
        const pixelado = ditherizarImagen(img, ancho, alto);
        pixelado.className = "cuadro__pixelado";
        img.before(pixelado);
        cuadro.pixelado = true;
        cuadro.nivelRevelado = -1;   // el próximo fotograma calculará el suyo
        aplicarMascara(img, 0);      // de momento, la imagen real oculta
      } catch (error) {
        // El navegador no nos deja leer los píxeles: plan B, sin pixelar
        console.warn(`No se pudo pixelar "${cuadro.obra.titulo}":`, error.message);
      }
    }

    cuadro.estado = "cargado";
    cuadro.elemento.classList.add("cuadro--cargado");
  }

  function alFallar() {
    if (!cuadro.sinCors) {
      cuadro.sinCors = true;
      img.crossOrigin = null;      // quita el atributo crossorigin
      pedir(cuadro.obra.imagen);   // y lo intenta otra vez, sin CORS
      return;
    }
    cuadro.estado = "error";
    cuadro.elemento.classList.add("cuadro--error");
  }

  img.crossOrigin = "anonymous";
  pedir(cuadro.obra.imagen + PARAMETRO_CORS);
}


// =============================================================
//  4. EL REVELADO
// =============================================================
//  Lejos del personaje, el cuadro se ve pixelado con la paleta del
//  museo. Al acercarse, la imagen real aparece por encima en 16
//  escalones, usando las máscaras de Bayer de dither.js.
// =============================================================

const REVELADO = {
  lejos: 90,    // a esta distancia (o más) el cuadro está pixelado del todo
  cerca: 24,    // a esta distancia (o menos) se ve la imagen real entera
  niveles: 16,  // escalones del fundido (uno por celda de la matriz de Bayer)
};

// ¿Soporta el navegador mask-image? (con o sin el prefijo -webkit-)
const HAY_MASCARAS = CSS.supports("mask-image", "none") || CSS.supports("-webkit-mask-image", "none");

let mascaras = [];        // las 17 máscaras, en el tamaño de píxel actual
let escalaMascaras = 0;   // escala con la que se crearon

// Las máscaras dependen del tamaño de un píxel en pantalla, así que
// se crean al empezar y otra vez si cambia la escala.
function prepararMascaras(plano, escala) {
  if (escala === escalaMascaras) return;
  mascaras = crearMascarasBayer(escala);
  escalaMascaras = escala;
  for (const cuadro of plano.cuadros) cuadro.nivelRevelado = -1;   // hay que volver a aplicarlas
}

// De la distancia al personaje a un nivel de revelado (0 a 16)
function nivelRevelado(distancia) {
  const t = (REVELADO.lejos - distancia) / (REVELADO.lejos - REVELADO.cerca);
  const limitado = Math.min(Math.max(t, 0), 1);
  const suave = limitado * limitado * (3 - 2 * limitado);   // curva en S: empieza y acaba despacio
  return Math.round(suave * REVELADO.niveles);
}

function aplicarMascara(img, nivel) {
  if (!HAY_MASCARAS) {
    img.style.opacity = nivel / REVELADO.niveles;   // plan B: fundido normal con opacidad
    return;
  }
  const valor = nivel >= REVELADO.niveles ? "none" : mascaras[nivel];
  img.style.webkitMaskImage = valor;
  img.style.maskImage = valor;
}

// Se llama en cada fotograma: ajusta el nivel de los cuadros visibles.
// Solo toca el estilo cuando el nivel cambia.
function actualizarRevelado(plano, xPersonaje, camaraX, vista) {
  const desde = camaraX - MEDIDAS.cuadroAncho;
  const hasta = camaraX + vista.ancho + MEDIDAS.cuadroAncho;
  for (const cuadro of plano.cuadros) {
    if (!cuadro.pixelado || cuadro.x < desde || cuadro.x > hasta) continue;
    const nivel = nivelRevelado(Math.abs(xPersonaje - cuadro.x));
    if (nivel !== cuadro.nivelRevelado) {
      cuadro.nivelRevelado = nivel;
      aplicarMascara(cuadro.img, nivel);
    }
  }
}


// =============================================================
//  5. CARGA PEREZOSA Y TRABAJO EN SEGUNDO PLANO
// =============================================================
//  · Imágenes: solo pedimos las de los cuadros que están cerca de la
//    cámara (lo visible más una pantalla a cada lado). Así no
//    descargamos todas de golpe al abrir la página.
//  · Entorno: generar un tramo tarda unos 20 ms, más que un fotograma
//    entero (16,7 ms a 60 fps). Si lo hacemos justo cuando el
//    personaje llega a una sala nueva, el juego da un tirón. Por eso
//    los generamos en los "ratos libres" del navegador, uno cada vez y
//    empezando por los más cercanos. Así, cuando llegas, ya están
//    hechos (casi siempre, mientras se mira la portada).
// =============================================================

// requestIdleCallback ejecuta una función cuando el navegador no tiene
// nada mejor que hacer. Safari no lo tiene: allí usamos un setTimeout.
const cuandoHayaTiempo = window.requestIdleCallback
  ? (funcion) => window.requestIdleCallback(funcion, { timeout: 300 })
  : (funcion) => setTimeout(funcion, 30);

let generacionProgramada = false;

function prepararZonaVisible(plano, camaraX, vista) {
  // 1. Lo que se ve YA tiene que estar generado (solo pasa al empezar o
  //    justo después de cambiar el tamaño de la ventana)
  const visibleDesde = camaraX - 8;
  const visibleHasta = camaraX + vista.ancho + 8;
  for (const tramo of plano.tramos) {
    const visible = tramo.fin > visibleDesde && tramo.inicio < visibleHasta;
    // Si cambió el alto de la ventana, el tramo está "caducado"
    if (visible && tramo.altoGenerado !== vista.alto) generarTramo(plano, tramo, vista.alto);
  }

  // 2. El resto, en segundo plano
  if (!generacionProgramada) programarGeneracion(plano, camaraX + vista.ancho / 2, vista);

  // 3. Las imágenes cercanas
  const desde = camaraX - vista.ancho;
  const hasta = camaraX + vista.ancho * 2;
  for (const cuadro of plano.cuadros) {
    if (cuadro.estado === "pendiente" && cuadro.x > desde && cuadro.x < hasta) cargarCuadro(cuadro);
  }
}

// Busca el tramo pendiente más cercano al centro de la cámara y lo
// genera en el próximo rato libre. Al acabar, el siguiente fotograma
// volverá a llamar aquí y programará el siguiente.
function programarGeneracion(plano, centroX, vista) {
  let masCercano = null;
  let menorDistancia = Infinity;
  for (const tramo of plano.tramos) {
    if (tramo.altoGenerado === vista.alto) continue;   // ya está hecho
    const distancia = Math.abs((tramo.inicio + tramo.fin) / 2 - centroX);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      masCercano = tramo;
    }
  }
  if (!masCercano) return;   // no queda nada pendiente

  generacionProgramada = true;
  const alto = vista.alto;
  cuandoHayaTiempo(() => {
    generacionProgramada = false;
    // Puede que, mientras esperaba, ya se generara (o cambiara el alto)
    if (masCercano.altoGenerado !== alto && alto === vista.alto) generarTramo(plano, masCercano, alto);
  });
}
