// =============================================================
//  juego.js — bucle principal, controles y cámara
// -------------------------------------------------------------
//  (El HUD y el visor están en interfaz.js.)
//
//  Estructura clásica de un videojuego:
//    1. Leer la entrada (teclado o botones táctiles) → guardamos qué
//       teclas están pulsadas.
//    2. actualizar(dt): mover al personaje y la cámara.
//    3. dibujar(): pintar el fotograma.
//  Los pasos 2 y 3 se repiten ~60 veces por segundo con
//  requestAnimationFrame.
// =============================================================


// --- Ajustes del movimiento (en píxeles lógicos y segundos) ---
const VELOCIDAD_ANDAR = 70;     // px/s
const VELOCIDAD_CORRER = 170;   // px/s con Mayús pulsada
const ACELERACION = 500;        // px/s²: cuánto tarda en arrancar y frenar
const SUAVIDAD_CAMARA = 5;      // más alto = la cámara va más pegada al personaje
const ADELANTO_CAMARA = 40;     // la cámara mira un poco hacia donde camina
const MARGEN_EXTREMOS = 14;     // el personaje no puede salir del pasillo


// --- Elementos de la página ---
const escena = document.getElementById("escena");
const mundo = document.getElementById("mundo");            // entorno + cuadros (museo.js)
const lienzo = document.getElementById("lienzo-frente");   // personaje, por delante
const ctx = lienzo.getContext("2d");
const cortinilla = document.getElementById("cortinilla");  // fundido al saltar de sala


// --- Estado del juego ---
const plano = crearPlano();   // posiciones de salas, cuadros y puertas (museo.js)

// "vista" describe el canvas: su tamaño en píxeles lógicos y la escala
const vista = {
  ancho: 0,
  alto: 0,
  escala: 1,      // píxeles FÍSICOS de pantalla por píxel lógico (entero)
  escalaCss: 1,   // píxeles CSS por píxel lógico (para colocar el HTML)
  dpr: 1,         // píxeles físicos por píxel CSS (devicePixelRatio)
};

const personaje = {
  x: 40,               // posición en el mundo (el centro de sus pies)
  velocidad: 0,        // px/s; negativa = hacia la izquierda
  direccion: 1,        // 1 = mira a la derecha, -1 = a la izquierda

  // Para la animación (ver sprites.js)
  estado: "quieto",    // "andando", "quieto" o "mirando" (de espaldas, ante un cuadro)
  fasePaso: 1,         // avanza con la distancia recorrida; su parte entera es el fotograma
  tiempoQuieto: 0,     // segundos que lleva parado
  cuadroDelante: null, // el cuadro que tiene delante, si hay uno
};

const camara = { x: 0 };   // coordenada del mundo en el borde izquierdo

// --- Controles: cada acción y las teclas que la activan ---
// Usamos evento.code (la tecla FÍSICA: "KeyA", "ArrowLeft"…) y no
// evento.key (el carácter que escribe: "a", "A"…). Con key, si pulsas
// Mayús para correr, la A llega como "A" mayúscula y al soltarla sin
// Mayús llega como "a": el juego no reconocería que es la misma tecla.
// Con code eso no pasa, y en teclados AZERTY las teclas WASD siguen
// en la misma posición. (La S no hace nada, a propósito.)
const CONTROLES = {
  izquierda: ["ArrowLeft", "KeyA"],
  derecha: ["ArrowRight", "KeyD"],
  correr: ["ShiftLeft", "ShiftRight"],
  ver: ["ArrowUp", "KeyW", "Enter", "NumpadEnter"],
  cerrar: ["ArrowDown", "Escape"],
};

// La tabla al revés, para buscar rápido: { KeyA: "izquierda", ArrowLeft: "izquierda", … }
const ACCION_DE_TECLA = {};
for (const [accion, codigos] of Object.entries(CONTROLES)) {
  for (const codigo of codigos) ACCION_DE_TECLA[codigo] = accion;
}

// Qué teclas físicas están pulsadas AHORA. Un Set guarda cada una una
// sola vez: si pulsas ← y A a la vez y sueltas una, la otra sigue
// contando. Los eventos de teclado solo cambian este Set; el
// movimiento se calcula en actualizar().
const teclasPulsadas = new Set();

// Los botones táctiles cuentan igual que las teclas
const tactil = { izquierda: false, derecha: false };

// ¿Se está pidiendo esta acción (con alguna de sus teclas o en pantalla)?
function pulsando(accion) {
  if (tactil[accion]) return true;
  return CONTROLES[accion].some((codigo) => teclasPulsadas.has(codigo));
}

let transicionActiva = false;   // true mientras dura el fundido de un salto de sala


// =============================================================
//  Utilidades matemáticas
// =============================================================

// Mantiene un valor entre un mínimo y un máximo
function limitar(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

// Acerca "actual" a "objetivo" como mucho "paso" unidades, sin pasarse
function acercar(actual, objetivo, paso) {
  if (actual < objetivo) return Math.min(actual + paso, objetivo);
  return Math.max(actual - paso, objetivo);
}


// =============================================================
//  Tamaño de la pantalla y escala
// =============================================================
//  Elegimos una escala ENTERA en píxeles físicos (2, 3, 4, 5…)
//  para que todos los píxeles lógicos midan exactamente lo mismo
//  en pantalla. Si la escala fuera 4,3, unos píxeles medirían 4 y
//  otros 5, y el pixel art se vería irregular.
//
//  devicePixelRatio es cuántos píxeles físicos hay en un píxel CSS
//  (en un portátil con Windows al 125 % vale 1,25). Lo tenemos en
//  cuenta para que la escala sea entera en la pantalla de verdad.
//
//  La escala es la mayor que deja ver al menos MEDIDAS.altoMinimo
//  píxeles lógicos de alto y ANCHO_MINIMO de ancho (en un móvil en
//  vertical manda el ancho, para que quepan al menos dos cuadros).
const ANCHO_MINIMO = 180;

function redimensionar() {
  const dpr = window.devicePixelRatio || 1;
  const anchoCss = escena.clientWidth;
  const altoCss = escena.clientHeight;

  // Nunca menos de 2: con escala 1 se perdería el aspecto pixelado
  // (en ventanas muy bajas se verá algo menos de pared, pero cabe).
  const porAlto = Math.floor((altoCss * dpr) / MEDIDAS.altoMinimo);
  const porAncho = Math.floor((anchoCss * dpr) / ANCHO_MINIMO);
  vista.escala = Math.max(2, Math.min(porAlto, porAncho));
  vista.escalaCss = vista.escala / dpr;
  vista.dpr = dpr;

  // Píxeles lógicos necesarios para cubrir toda la escena (redondeando hacia arriba)
  vista.ancho = Math.ceil(anchoCss / vista.escalaCss);
  vista.alto = Math.ceil(altoCss / vista.escalaCss);

  // El canvas del personaje tiene la resolución REAL de la pantalla
  // (un píxel del canvas = un píxel físico). Así podemos colocar al
  // personaje con precisión de píxel físico y no a saltos de píxel
  // lógico (ver dibujar()).
  lienzo.width = vista.ancho * vista.escala;
  lienzo.height = vista.alto * vista.escala;
  lienzo.style.width = vista.ancho * vista.escalaCss + "px";
  lienzo.style.height = vista.alto * vista.escalaCss + "px";
  // Al ampliar el sprite con drawImage, sin suavizar (si no, se vería borroso).
  // Hay que ponerlo después de cambiar el tamaño: eso reinicia el contexto.
  ctx.imageSmoothingEnabled = false;

  // El mundo se coloca con CSS: le pasamos el tamaño de un píxel
  // lógico y el alto de la escena, y el CSS recalcula todo lo demás.
  // --px va en la raíz (:root) porque también lo usa el visor.
  // Los tramos de entorno se regeneran solos en el siguiente
  // fotograma si ha cambiado el alto (ver prepararZonaVisible).
  document.documentElement.style.setProperty("--px", vista.escalaCss + "px");
  mundo.style.setProperty("--alto", vista.alto);

  // Las máscaras del revelado se dibujan al tamaño del píxel en pantalla
  prepararMascaras(plano, vista.escala);

  // El mapa del HUD tiene su propio canvas (interfaz.js)
  redimensionarInterfaz();
}


// =============================================================
//  Controles de teclado
// =============================================================
function alPulsarTecla(evento) {
  // Con Ctrl, Alt o Cmd es un atajo del navegador (Ctrl+D, Ctrl+W…):
  // no es para nosotros
  if (evento.ctrlKey || evento.altKey || evento.metaKey) return;

  const accion = ACCION_DE_TECLA[evento.code];   // undefined si la tecla no hace nada

  // En la portada el juego aún no ha empezado. Enter entra al museo
  // (si el foco está en un botón o enlace, ya lo gestiona el navegador).
  if (portadaVisible()) {
    if (evento.key === "Enter" && evento.target === document.body) {
      entrarAlMuseo();
      evento.preventDefault();
    }
    return;
  }

  // Con el visor abierto el museo no se mueve: solo escuchamos las
  // teclas de cerrar. (El <dialog> ya se cierra solo con Esc; lo
  // repetimos aquí por si el foco no estuviera dentro del diálogo.)
  if (visorAbierto()) {
    if (accion === "cerrar") {
      cerrarVisor();
      evento.preventDefault();
    }
    return;
  }

  // Las cifras 1–6 saltan a esa sala. /^[1-9]$/ es una expresión
  // regular: "exactamente un carácter, del 1 al 9".
  if (/^[1-9]$/.test(evento.key)) {
    saltarASala(Number(evento.key) - 1);
    return;
  }

  if (!accion) return;        // otra tecla (la S, por ejemplo): no hace nada
  evento.preventDefault();    // que las flechas no hagan scroll en la página
  teclasPulsadas.add(evento.code);

  // evento.repeat es true si la tecla se queda pulsada: así no se abre
  // y se cierra el visor en bucle
  if (accion === "ver" && !evento.repeat) verDeCerca();
}

// Soltar una tecla se registra SIEMPRE, estemos en la portada, en el
// visor o en el museo: así ninguna se queda "pegada".
function alSoltarTecla(evento) {
  teclasPulsadas.delete(evento.code);
}

window.addEventListener("keydown", alPulsarTecla);
window.addEventListener("keyup", alSoltarTecla);

// Si la ventana pierde el foco con una tecla pulsada, nunca nos
// llegaría su "keyup" y el personaje seguiría andando solo.
function soltarTeclas() {
  teclasPulsadas.clear();
  tactil.izquierda = tactil.derecha = false;
}
window.addEventListener("blur", soltarTeclas);

// ↑ / W / Enter: abre el visor si hay un cuadro delante
function verDeCerca() {
  if (!personaje.cuadroDelante) return;
  abrirVisorDesdeJuego(personaje.cuadroDelante);
}

// Antes de abrir el visor, el personaje se para en seco
function abrirVisorDesdeJuego(cuadro) {
  if (portadaVisible() || transicionActiva) return;
  soltarTeclas();
  personaje.velocidad = 0;
  abrirVisor(cuadro);   // interfaz.js
}


// =============================================================
//  Saltar a una sala (teclas 1–6 o clic en el mapa)
// =============================================================
//  Con un fundido "píxel a píxel": la cortinilla negra aparece con
//  las máscaras de Bayer, con la pantalla tapada movemos al
//  personaje y la cámara, y la cortinilla desaparece igual.
const DURACION_CORTINILLA = 220;   // ms de cada mitad del fundido

function saltarASala(indice) {
  const sala = plano.salas[indice];
  if (!sala || transicionActiva || visorAbierto() || portadaVisible()) return;

  transicionActiva = true;
  cortinilla.hidden = false;
  animarMascara(cortinilla, 0, REVELADO.niveles, DURACION_CORTINILLA, () => {
    personaje.x = sala.inicio + 20;   // justo a la izquierda del rótulo de la sala
    personaje.velocidad = 0;
    personaje.direccion = 1;
    camara.x = objetivoCamara();      // la cámara, directamente en su sitio
    animarMascara(cortinilla, REVELADO.niveles, 0, DURACION_CORTINILLA, () => {
      cortinilla.hidden = true;
      transicionActiva = false;
    });
  });
}


// =============================================================
//  Controles táctiles
// =============================================================
//  Usamos "pointer events", que funcionan igual con dedo, ratón o
//  lápiz. setPointerCapture hace que el botón reciba el "soltar"
//  aunque el dedo se haya deslizado fuera de él.

// Flechas en pixel art (matrices de caracteres, como el personaje)
const ICONOS_TACTILES = {
  derecha: ["#....", "##...", "###..", "####.", "###..", "##...", "#...."],
  ver: ["...#...", "..###..", ".#####.", "#######", "..###..", "..###..", "..###.."],
};

function crearIcono(filas, voltear) {
  const lienzoIcono = document.createElement("canvas");
  const ancho = filas[0].length;
  lienzoIcono.width = Math.max(ancho, filas.length);
  lienzoIcono.height = lienzoIcono.width;
  const ctxIcono = lienzoIcono.getContext("2d");
  const dx = Math.floor((lienzoIcono.width - ancho) / 2);
  const dy = Math.floor((lienzoIcono.height - filas.length) / 2);
  filas.forEach((fila, y) => {
    for (let x = 0; x < fila.length; x++) {
      if (fila[x] !== "#") continue;
      const xFinal = voltear ? ancho - 1 - x : x;
      rect(ctxIcono, PALETA.blanco, dx + xFinal, dy + y, 1, 1);
    }
  });
  return lienzoIcono;
}

function configurarControlesTactiles() {
  for (const boton of document.querySelectorAll(".tactil__boton")) {
    const accion = boton.dataset.accion;   // "izquierda", "derecha" o "ver"

    if (accion === "ver") boton.append(crearIcono(ICONOS_TACTILES.ver));
    else boton.append(crearIcono(ICONOS_TACTILES.derecha, accion === "izquierda"));

    boton.addEventListener("pointerdown", (evento) => {
      evento.preventDefault();
      boton.classList.add("pulsado");
      if (accion === "ver") verDeCerca();
      else tactil[accion] = true;
      // La captura es una mejora, no algo imprescindible: si el
      // navegador la rechaza, el botón tiene que funcionar igual
      try {
        boton.setPointerCapture(evento.pointerId);
      } catch (error) {
        // sin captura: soltaremos con pointerup o pointercancel
      }
    });

    const soltar = () => {
      boton.classList.remove("pulsado");
      if (accion !== "ver") tactil[accion] = false;
    };
    boton.addEventListener("pointerup", soltar);
    boton.addEventListener("pointercancel", soltar);
    boton.addEventListener("lostpointercapture", soltar);
    // Mantener pulsado en un móvil abre un menú: lo evitamos
    boton.addEventListener("contextmenu", (evento) => evento.preventDefault());
  }
}


// =============================================================
//  actualizar(dt): avanza el estado del juego dt segundos
// =============================================================
function actualizar(dt) {
  // --- Personaje ---
  // eje = -1 (izquierda), 0 (quieto o ambas flechas) o 1 (derecha).
  // En la portada o durante un salto de sala, el personaje no anda.
  const bloqueado = portadaVisible() || transicionActiva;
  const eje = bloqueado ? 0 : (pulsando("derecha") ? 1 : 0) - (pulsando("izquierda") ? 1 : 0);
  const velocidadMaxima = pulsando("correr") ? VELOCIDAD_CORRER : VELOCIDAD_ANDAR;

  // En vez de cambiar la velocidad de golpe, la acercamos poco a poco
  // a la velocidad deseada: así arranca y frena con suavidad.
  personaje.velocidad = acercar(personaje.velocidad, eje * velocidadMaxima, ACELERACION * dt);

  // Movimiento basado en el tiempo: espacio = velocidad × tiempo.
  // Así va igual de rápido a 30, 60 o 144 fotogramas por segundo.
  personaje.x += personaje.velocidad * dt;

  // Que no se salga por los extremos del museo
  const xLimitada = limitar(personaje.x, MARGEN_EXTREMOS, plano.ancho - MARGEN_EXTREMOS);
  if (xLimitada !== personaje.x) {
    personaje.x = xLimitada;
    personaje.velocidad = 0;
  }

  if (eje !== 0) personaje.direccion = eje;

  // --- Estado para la animación ---
  const andando = Math.abs(personaje.velocidad) > 1;
  if (andando) {
    personaje.tiempoQuieto = 0;
    // La animación avanza según la DISTANCIA recorrida, no según el
    // tiempo: así los pies no "patinan" ni al arrancar, ni al frenar,
    // ni al correr (corriendo, los fotogramas pasan más deprisa).
    personaje.fasePaso += (Math.abs(personaje.velocidad) * dt) / LONGITUD_FOTOGRAMA;
  } else {
    personaje.tiempoQuieto += dt;
    personaje.fasePaso = 1;   // al arrancar, empieza con las piernas juntas
  }

  personaje.cuadroDelante = cuadroEnPosicion(plano, personaje.x);

  // Una pequeña máquina de estados: andando → quieto → (si hay un
  // cuadro delante y lleva un momento parado) mirando
  if (andando) {
    personaje.estado = "andando";
  } else if (personaje.cuadroDelante && personaje.tiempoQuieto >= RETRASO_GIRO) {
    personaje.estado = "mirando";
  } else {
    personaje.estado = "quieto";
  }

  // --- Cámara ---
  // Suavizado exponencial: cada fotograma recorre una fracción de la
  // distancia que falta. Usar exp(-k·dt) hace que el resultado no
  // dependa de los fotogramas por segundo.
  camara.x += (objetivoCamara() - camara.x) * (1 - Math.exp(-SUAVIDAD_CAMARA * dt));
}

// Dónde debería estar la cámara: el personaje en el centro, un poco
// adelantado hacia donde mira, y sin salirse de los extremos del museo.
// En pantallas estrechas el adelanto se reduce para que el personaje
// no acabe pegado al borde.
function objetivoCamara() {
  const adelanto = Math.min(ADELANTO_CAMARA, vista.ancho * 0.15);
  const objetivo = personaje.x - vista.ancho / 2 + personaje.direccion * adelanto;
  return limitar(objetivo, 0, Math.max(0, plano.ancho - vista.ancho));
}


// =============================================================
//  dibujar(): pinta un fotograma completo
// =============================================================
let camaraDibujada = null;

function dibujar() {
  // CÁMARA "SUBPÍXEL": redondeamos la cámara a píxeles FÍSICOS, no a
  // píxeles lógicos. El pixel art sigue nítido (cada píxel lógico mide
  // un número entero de píxeles de pantalla), pero el mundo avanza de
  // 1 en 1 píxel físico en vez de a saltos de 3, 4 o 5. Los saltos
  // grandes e irregulares (unos fotogramas 1 píxel lógico, otros 2) son
  // los que hacían que el movimiento pareciera entrecortado.
  const camaraFisica = Math.round(camara.x * vista.escala);
  const camaraX = camaraFisica / vista.escala;   // en píxeles lógicos, con decimales

  // Genera el entorno y pide las imágenes de lo que está cerca
  prepararZonaVisible(plano, camaraX, vista);

  // Pixelado o real, según lo cerca que esté el personaje de cada cuadro
  actualizarRevelado(plano, personaje.x, camaraX, vista);

  // Mover la cámara = desplazar #mundo hacia el lado contrario.
  // Solo tocamos el estilo si la cámara se ha movido.
  if (camaraFisica !== camaraDibujada) {
    mundo.style.transform = `translate3d(${-camaraFisica / vista.dpr}px, 0, 0)`;
    camaraDibujada = camaraFisica;
  }

  // El canvas del personaje se borra y se repinta en cada fotograma.
  // setTransform(escala, …) hace que cada unidad que dibujemos mida
  // "escala" píxeles físicos: seguimos dibujando en píxeles lógicos.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  ctx.setTransform(vista.escala, 0, 0, vista.escala, 0, 0);

  // La X del personaje en pantalla, también alineada a un píxel físico
  const xFisica = Math.round(personaje.x * vista.escala) - camaraFisica;
  const yPies = vista.alto - MEDIDAS.suelo + MEDIDAS.piesPersonaje;
  dibujarPersonaje(ctx, personaje, xFisica / vista.escala, yPies);   // sprites.js
}


// =============================================================
//  Bucle principal
// =============================================================
let tiempoAnterior = null;

function bucle(ahora) {
  // "ahora" lo pasa requestAnimationFrame, en milisegundos
  if (tiempoAnterior === null) tiempoAnterior = ahora;

  // dt = segundos desde el fotograma anterior. Lo limitamos a 0,05 s:
  // si cambias de pestaña y vuelves, no queremos un salto enorme.
  const dt = Math.min((ahora - tiempoAnterior) / 1000, 0.05);
  tiempoAnterior = ahora;

  actualizar(dt);
  dibujar();
  actualizarHud(plano, personaje);   // interfaz.js

  requestAnimationFrame(bucle);
}


// =============================================================
//  Arranque
// =============================================================
function iniciar() {
  construirMuseo(plano, mundo);   // crea los tramos, cuadros y rótulos (museo.js)

  // Con el ratón (o el dedo) también se puede abrir un cuadro…
  for (const cuadro of plano.cuadros) {
    cuadro.elemento.addEventListener("click", () => abrirVisorDesdeJuego(cuadro));
  }
  // …o elegir una sala en el mapa del HUD
  hud.mapa.addEventListener("click", (evento) => saltarASala(salaEnMapa(plano, evento)));

  configurarControlesTactiles();

  redimensionar();
  window.addEventListener("resize", () => {
    redimensionar();
    camaraDibujada = null;        // fuerza a recolocar el mundo con la nueva escala
  });

  // Colocamos la cámara directamente en su sitio para que no
  // haga un barrido al cargar la página.
  camara.x = objetivoCamara();

  requestAnimationFrame(bucle);
}

iniciar();
