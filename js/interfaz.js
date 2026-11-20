// =============================================================
//  interfaz.js — el HUD (panel inferior) y el visor de obras
// -------------------------------------------------------------
//  · Cartela: los datos de la obra que el personaje tiene delante
//    (o de la sala, si no hay ninguna).
//  · Recorrido: un mapa pixelado de las seis salas con un punto
//    azul donde está el personaje y una marca por cada obra vista.
//  · Obras vistas: se guardan en localStorage para no perderlas
//    al cerrar la página.
//  · Visor: la obra a pantalla completa con su ficha.
// =============================================================


// =============================================================
//  1. OBRAS VISTAS (guardadas en el navegador)
// =============================================================
//  localStorage guarda texto, así que convertimos el conjunto de
//  ids en un array y luego en JSON. Va siempre dentro de try/catch:
//  en modo privado, o si el usuario lo ha bloqueado, localStorage
//  puede lanzar un error, y el juego debe seguir funcionando igual
//  (solo que sin recordar las obras al cerrar).
// =============================================================
const CLAVE_VISTAS = "galeria:obrasVistas";

function cargarVistas() {
  try {
    const texto = localStorage.getItem(CLAVE_VISTAS);
    const lista = texto ? JSON.parse(texto) : [];
    return new Set(Array.isArray(lista) ? lista : []);
  } catch (error) {
    return new Set();
  }
}

function guardarVistas() {
  try {
    localStorage.setItem(CLAVE_VISTAS, JSON.stringify([...obrasVistas]));
  } catch (error) {
    // Sin almacenamiento disponible: las vistas se quedan solo en memoria
  }
}

// Un Set es como un array sin repetidos, y .has() es instantáneo
const obrasVistas = cargarVistas();

// Marca una obra como vista. Devuelve true si es nueva.
function marcarVista(obra) {
  if (obrasVistas.has(obra.id)) return false;
  obrasVistas.add(obra.id);
  guardarVistas();
  hud.vistas.textContent = obrasVistas.size;
  destellar(hud.vistas.parentElement);
  return true;
}

// Reinicia una animación CSS: quitar la clase, forzar al navegador a
// "darse cuenta" (leer offsetWidth lo obliga) y volver a ponerla.
function destellar(elemento) {
  elemento.classList.remove("destello");
  void elemento.offsetWidth;
  elemento.classList.add("destello");
}


// =============================================================
//  2. HUD
// =============================================================
const hud = {
  etiqueta: document.getElementById("hud-etiqueta"),
  extra: document.getElementById("hud-extra"),
  titulo: document.getElementById("hud-titulo"),
  linea1: document.getElementById("hud-linea1"),
  linea2: document.getElementById("hud-linea2"),
  vistas: document.getElementById("hud-vistas"),
  total: document.getElementById("hud-total"),
  mapa: document.getElementById("hud-mapa"),
  mapaContenedor: document.getElementById("hud-mapa-contenedor"),
};

hud.total.textContent = OBRAS.length;
hud.vistas.textContent = obrasVistas.size;

// Lo que muestra ahora la cartela, para no reescribirla sin necesidad
let obraEnCartela;        // undefined al principio: obliga a escribirla
let salaEnCartela = -1;

// Se llama en cada fotograma desde el bucle principal
function actualizarHud(plano, personaje) {
  const cuadro = personaje.cuadroDelante;
  const obra = cuadro ? cuadro.obra : null;
  const sala = cuadro ? cuadro.sala : salaEnPosicion(plano, personaje.x);

  // Cuenta como vista cuando el personaje se para a mirarla
  const nueva = cuadro && personaje.estado === "mirando" && marcarVista(obra);

  if (obra !== obraEnCartela || sala !== salaEnCartela || nueva) {
    escribirCartela(obra, sala);
    obraEnCartela = obra;
    salaEnCartela = sala;
  }

  dibujarMapa(plano, personaje.x, sala);
}

function escribirCartela(obra, indiceSala) {
  const sala = SALAS[indiceSala];
  if (obra) {
    hud.etiqueta.textContent = `Obra · Sala ${sala.numero}`;
    hud.extra.textContent = (obrasVistas.has(obra.id) ? "✓ vista · " : "") + "↑ ver de cerca";
    hud.titulo.textContent = obra.titulo;
    hud.linea1.textContent = `${obra.artista} · ${obra.nacionalidad}`;
    hud.linea2.textContent = `${obra.fecha} · ${obra.tecnica}`;
  } else {
    hud.etiqueta.textContent = `Sala ${sala.numero}`;
    hud.extra.textContent = "";
    hud.titulo.textContent = sala.nombre;
    hud.linea1.textContent = `${sala.años} · ${sala.obras.length} obras`;
    hud.linea2.textContent = "Acércate a un cuadro para ver su cartela";
  }
}


// =============================================================
//  3. MAPA DEL RECORRIDO (un canvas pixelado)
// =============================================================
//  Fila 0–4: números romanos de las salas (letras de 5 píxeles)
//  Fila 8–10: una barra por sala, con las obras vistas en azul
//  Fila 7–11: el personaje (un punto azul con el centro blanco)
// =============================================================
const ALTO_MAPA = 13;
const ctxMapa = hud.mapa.getContext("2d");
let claveMapa = "";   // resumen de lo último que se dibujó

// Letras de los números romanos: solo hacen falta la I y la V.
// Son matrices de caracteres, igual que los sprites del personaje.
const LETRAS_PIXEL = {
  I: ["#", "#", "#", "#", "#"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
};

// El mapa usa su propia escala entera (2 píxeles CSS por píxel, más
// o menos), calculada como la de la escena para que no se deforme.
function redimensionarInterfaz() {
  const dpr = window.devicePixelRatio || 1;
  const escala = Math.max(1, Math.round(2 * dpr));   // píxeles físicos por píxel del mapa
  const escalaCss = escala / dpr;
  const anchoCss = hud.mapaContenedor.clientWidth;

  hud.mapa.width = Math.max(20, Math.floor(anchoCss / escalaCss));
  hud.mapa.height = ALTO_MAPA;
  hud.mapa.style.width = hud.mapa.width * escalaCss + "px";
  hud.mapa.style.height = ALTO_MAPA * escalaCss + "px";
  claveMapa = "";   // cambiar el tamaño borra el canvas: hay que redibujar
}

function dibujarMapa(plano, xPersonaje, salaActual) {
  const ancho = hud.mapa.width;
  const margen = 2;
  // Convierte una X del museo en una X del mapa
  const aMapa = (x) => margen + Math.round((x / plano.ancho) * (ancho - margen * 2 - 1));
  const xp = aMapa(xPersonaje);

  // Solo redibujamos si ha cambiado algo que se vea
  const clave = `${xp}|${salaActual}|${obrasVistas.size}|${ancho}`;
  if (clave === claveMapa) return;
  claveMapa = clave;

  ctxMapa.clearRect(0, 0, ancho, ALTO_MAPA);

  for (const sala of plano.salas) {
    const actual = sala.indice === salaActual;
    const x0 = aMapa(sala.inicio);
    const x1 = aMapa(sala.fin);
    rect(ctxMapa, actual ? PALETA.paredOscura : PALETA.humo, x0, 8, Math.max(1, x1 - x0), 3);
    for (const cuadro of sala.cuadros) {
      if (obrasVistas.has(cuadro.obra.id)) rect(ctxMapa, PALETA.azulClaro, aMapa(cuadro.x), 8, 1, 3);
    }
    escribirPixel(ctxMapa, sala.datos.numero, Math.round((x0 + x1) / 2), 0, actual ? PALETA.azulClaro : PALETA.humo);
  }

  // El personaje
  rect(ctxMapa, PALETA.azul, xp - 1, 7, 3, 5);
  rect(ctxMapa, PALETA.blanco, xp, 8, 1, 3);
}

// Escribe un texto con LETRAS_PIXEL, centrado en xCentro
function escribirPixel(ctx, texto, xCentro, y, color) {
  const letras = [...texto];
  const anchoTotal = letras.reduce((suma, letra) => suma + LETRAS_PIXEL[letra][0].length + 1, -1);
  let x = xCentro - Math.floor(anchoTotal / 2);
  ctx.fillStyle = color;
  for (const letra of letras) {
    const forma = LETRAS_PIXEL[letra];
    forma.forEach((fila, dy) => {
      for (let dx = 0; dx < fila.length; dx++) {
        if (fila[dx] === "#") ctx.fillRect(x + dx, y + dy, 1, 1);
      }
    });
    x += forma[0].length + 1;   // ancho de la letra + 1 píxel de separación
  }
}


// =============================================================
//  4. VISOR DE OBRA
// =============================================================
const visor = {
  dialogo: document.getElementById("visor"),
  imagen: document.getElementById("visor-imagen"),
  sala: document.getElementById("visor-sala"),
  titulo: document.getElementById("visor-titulo"),
  artista: document.getElementById("visor-artista"),
  nacionalidad: document.getElementById("visor-nacionalidad"),
  fecha: document.getElementById("visor-fecha"),
  tecnica: document.getElementById("visor-tecnica"),
  estado: document.getElementById("visor-estado"),
  enlace: document.getElementById("visor-enlace"),
  cerrar: document.getElementById("visor-cerrar"),
};

let obraEnVisor = null;   // la obra abierta ahora mismo (null si está cerrado)
let cargaOriginal = null; // la imagen en alta resolución que se está descargando

function visorAbierto() {
  return visor.dialogo.open;
}

function abrirVisor(cuadro) {
  const { obra } = cuadro;
  const sala = SALAS[cuadro.sala];
  obraEnVisor = obra;
  marcarVista(obra);

  // Ficha
  visor.sala.textContent = `Sala ${sala.numero} · ${sala.nombre}`;
  visor.titulo.textContent = obra.titulo;
  visor.artista.textContent = obra.artista;
  visor.nacionalidad.textContent = obra.nacionalidad;
  visor.fecha.textContent = obra.fecha;
  visor.tecnica.textContent = obra.tecnica;
  visor.enlace.href = obra.enlace;
  visor.imagen.alt = `${obra.titulo}, de ${obra.artista}`;

  // 1. Primero la imagen "web-large", que es ligera y llega enseguida.
  //    Usamos la URL normal, NUNCA la que lleva PARAMETRO_CORS: esta
  //    <img> no pide CORS, y pedir sin CORS una URL con el parámetro
  //    estropearía la caché del CDN (ver la nota en museo.js).
  visor.imagen.src = obra.imagen;

  // 2. Mientras tanto, la original (puede pesar varios megas)
  cargarOriginal(obra);

  visor.dialogo.showModal();
  visor.dialogo.focus();         // el foco en el diálogo, no en un botón
  animarDisolucion(visor.imagen);
}

function cargarOriginal(obra) {
  mostrarEstado("cargando en alta resolución…", "cargando");
  const original = new Image();
  cargaOriginal = original;

  // Cuando termina de descargarse, la cambiamos por la que se ve. La
  // <img> del visor tiene decoding="async" (en index.html): el navegador
  // la descomprime sin bloquear, así que el cambio no da tirones.
  // (No usamos decode(): ver la nota en cargarCuadro, en museo.js.)
  original.onload = () => {
    if (obraEnVisor !== obra) return;   // el usuario ya cerró o cambió de obra
    visor.imagen.src = original.src;
    mostrarEstado("alta resolución ✓", "listo");
  };
  original.onerror = () => {
    if (obraEnVisor !== obra) return;   // también salta al cancelar la descarga
    mostrarEstado("sin versión original: se ve la versión web", "");
  };
  original.src = obra.imagenHD;
}

function mostrarEstado(texto, tipo) {
  visor.estado.textContent = texto;
  visor.estado.className = "visor__estado" + (tipo ? ` visor__estado--${tipo}` : "");
}

function cerrarVisor() {
  if (visorAbierto()) visor.dialogo.close();
  limpiarVisor();
}

// Deja el visor como nuevo. Se puede llamar varias veces sin problema
// (decimos que es "idempotente"): la llamamos al cerrar con nuestro
// código y también desde el evento "close", que el navegador lanza un
// poco después (es asíncrono) o cuando cierra el diálogo por su cuenta.
function limpiarVisor() {
  obraEnVisor = null;        // así una descarga que acabe tarde ya no se muestra
  if (cargaOriginal) {
    cargaOriginal.src = "";  // cancela la descarga si aún no había terminado
    cargaOriginal = null;
  }
  visor.imagen.removeAttribute("src");   // libera la memoria de la imagen grande
}

visor.dialogo.addEventListener("close", limpiarVisor);

visor.cerrar.addEventListener("click", cerrarVisor);

// Un clic en el fondo oscuro (fuera de la imagen y de la ficha) cierra
visor.dialogo.addEventListener("click", (evento) => {
  if (evento.target === visor.dialogo || evento.target.classList.contains("visor__contenido") ||
      evento.target.classList.contains("visor__marco")) {
    cerrarVisor();
  }
});

// La imagen del visor aparece con la misma disolución de Bayer que
// los cuadros, pero animada en el tiempo
function animarDisolucion(img) {
  animarMascara(img, 0, REVELADO.niveles, 400);
}


// =============================================================
//  5. ANIMACIONES CON LAS MÁSCARAS DE BAYER
// =============================================================
//  animarMascara() lleva un elemento del nivel "desde" al nivel
//  "hasta" (0 = invisible, 16 = entero) en "duracion" milisegundos,
//  y al acabar llama a alTerminar. La usan el visor, la portada y
//  la cortinilla al saltar de sala.
//
//  Si el usuario ha pedido a su sistema "reducir el movimiento"
//  (una opción de accesibilidad), saltamos directamente al final.
// =============================================================
const MOVIMIENTO_REDUCIDO = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animarMascara(elemento, desde, hasta, duracion, alTerminar) {
  if (MOVIMIENTO_REDUCIDO || duracion <= 0) {
    aplicarMascara(elemento, hasta);
    if (alTerminar) alTerminar();
    return;
  }
  const inicio = performance.now();
  aplicarMascara(elemento, desde);
  function paso(ahora) {
    const t = Math.min(1, (ahora - inicio) / duracion);   // de 0 a 1
    aplicarMascara(elemento, Math.round(desde + (hasta - desde) * t));
    if (t < 1) requestAnimationFrame(paso);
    else if (alTerminar) alTerminar();
  }
  requestAnimationFrame(paso);
}


// =============================================================
//  6. CLIC EN EL MAPA
// =============================================================
// Convierte un clic (o un toque) en el mapa en el índice de la sala
// que hay debajo. Es la operación contraria a aMapa() en dibujarMapa.
function salaEnMapa(plano, evento) {
  const caja = hud.mapa.getBoundingClientRect();
  const xMapa = ((evento.clientX - caja.left) / caja.width) * hud.mapa.width;
  const margen = 2;
  const xMuseo = ((xMapa - margen) / (hud.mapa.width - margen * 2 - 1)) * plano.ancho;
  return salaEnPosicion(plano, Math.min(Math.max(xMuseo, 0), plano.ancho));
}
