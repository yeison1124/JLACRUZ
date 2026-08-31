/**
 * main.js — Página pública J. LACRUZ C.A.
 * Lógica del catálogo e-commerce, carrito (localStorage),
 * chatbot (componente inteligente) y animaciones de la landing page.
 */

// Detección automática del backend (local / hosting jlacruzca.com)
const HOSTING_URL    = 'https://jlacruzca.com/';
const API_BASE       = window.location.hostname.includes('jlacruzca.com') ? '/' : HOSTING_URL;
const API_ECOMMERCE  = API_BASE + '?views=ecommercePublico';
const API_CHATBOT    = API_BASE + '?views=chatbot';
const FOTOS_BASE     = API_BASE + 'src/assets/fotosModulos/';
const KEY_CARRITO    = 'itemsCarritoPedido';

// Tasa del dólar BCV (se actualiza desde la API de monedas)
let tasaDolar = 36.5;

// Productos cargados de la BD
let productosData = [];

// #endregion

// #region [CARRITO — localStorage (mismo key que el sistema)]

/**
 * Lee el carrito del localStorage.
 */
function leerCarrito() {
  try {
    const raw = localStorage.getItem(KEY_CARRITO);
    if (!raw) return { productos: {} };
    return JSON.parse(raw) || { productos: {} };
  } catch {
    return { productos: {} };
  }
}

/**
 * Guarda el carrito en localStorage.
 */
function guardarCarrito(carrito) {
  localStorage.setItem(KEY_CARRITO, JSON.stringify(carrito));
}

/**
 * Agrega un producto al carrito o aumenta su cantidad.
 */
function agregarAlCarrito(infoProducto) {
  const carrito = leerCarrito();
  const id = infoProducto.id_presentacion_producto;

  if (!carrito.productos) carrito.productos = {};

  if (carrito.productos[id]) {
    carrito.productos[id].cantidad += 1;
  } else {
    carrito.productos[id] = {
      ...infoProducto,
      tipo_item: 'productos',
      cantidad: 1
    };
  }
  guardarCarrito(carrito);
  renderizarOffcanvasCarrito();
  actualizarBadgeCarrito();
}

/**
 * Renderiza todos los ítems del offcanvas del carrito.
 */
function renderizarOffcanvasCarrito() {
  const carrito      = leerCarrito();
  const deposito     = document.querySelector('.depositoDetallesPedido');
  const carritoVacio = document.querySelector('.carritoVacio');
  const molde        = document.querySelector('.moldeItemPedido');

  if (!deposito || !molde) return;

  deposito.innerHTML = '';
  const productos = carrito.productos || {};
  const totalItems = Object.values(productos).reduce((s, p) => s + (p.cantidad || 0), 0);

  if (totalItems === 0) {
    carritoVacio.classList.remove('d-none');
    carritoVacio.classList.add('d-flex');
    recalcularTotalesCarrito();
    return;
  }

  carritoVacio.classList.add('d-none');
  carritoVacio.classList.remove('d-flex');

  for (const [idPres, prod] of Object.entries(productos)) {
    const item = molde.cloneNode(true);
    item.classList.remove('d-none', 'moldeItemPedido');
    item.classList.add('itemPedido');

    item.dataset.id_producto              = prod.id_producto;
    item.dataset.id_presentacion_producto = idPres;
    item.dataset.tipo_item                = 'productos';
    item.dataset.precio_producto          = prod.precio_producto || 0;
    item.dataset.cantidad_pmp             = prod.cantidad_pmp   || 1;

    const foto = prod.foto_presentacion && prod.foto_presentacion !== ''
      ? FOTOS_BASE + 'presentaciones_productos/' + prod.foto_presentacion
      : './img/aseo-limpieza.jpg';
    item.querySelector('.imagenItemPedido').src = foto;

    const nombre = (prod.nombre_producto || '') + ' - ' + (prod.nombre_presentacion || '');
    item.querySelector('.nombreItem').textContent = nombre;

    item.querySelector('.cantidadItemCarrito').textContent = prod.cantidad;

    deposito.appendChild(item);
  }

  recalcularTotalesCarrito();
}

/**
 * Recalcula precios, descuentos y totales del carrito.
 */
function recalcularTotalesCarrito() {
  const carrito    = leerCarrito();
  const productos  = carrito.productos || {};
  const tipoPago   = document.querySelector('.panelCotizacionPedido .btnTipoPago.active')?.dataset.tipo_pago || 'bs';
  const signo      = tipoPago === 'bs' ? ' Bs' : '$';
  let totalBase    = 0;
  let totalDescuento = 0;
  let nroItems     = 0;

  document.querySelectorAll('.panelCotizacionPedido .signoPrecio')
    .forEach(el => el.textContent = signo);

  document.querySelectorAll('.depositoDetallesPedido .itemPedido')
    .forEach(itemEl => {
      const idPres    = itemEl.dataset.id_presentacion_producto;
      const prod      = productos[idPres];
      if (!prod) return;

      const cantidad  = prod.cantidad || 1;
      nroItems       += cantidad;
      const precioProd = parseFloat(prod.precio_producto || 0);
      const cantPmp    = parseFloat(prod.cantidad_pmp    || 1);
      let precioUnit   = precioProd * cantPmp;

      if (tipoPago === 'bs') precioUnit *= tasaDolar;

      const precioMayor = precioUnit * 0.9;
      const subtotalBase = precioUnit * cantidad;
      const subtotalDesc = cantidad >= 20 ? subtotalBase * 0.9 : subtotalBase;

      itemEl.querySelector('.precioBaseItem').textContent = formatearMonto(precioUnit);
      itemEl.querySelector('.precioMayorItem').textContent = formatearMonto(precioMayor);
      itemEl.querySelector('.cantidadSubTotalBase').textContent = formatearMonto(subtotalBase);
      itemEl.querySelector('.cantidadSubTotalDescuento').textContent = formatearMonto(subtotalDesc);

      if (cantidad >= 20) {
        itemEl.querySelector('.subTotalBase')?.classList.remove('d-none');
      } else {
        itemEl.querySelector('.subTotalBase')?.classList.add('d-none');
      }

      totalBase      += subtotalBase;
      totalDescuento += subtotalDesc;
    });

  const badgeNav  = document.getElementById('badgeCarritoNav');
  const badgeCart = document.querySelector('.nroItemsPedido');
  if (nroItems > 0) {
    badgeNav && badgeNav.classList.remove('d-none');
    badgeNav && (badgeNav.textContent = nroItems);
    badgeCart && badgeCart.classList.remove('d-none');
    badgeCart && (badgeCart.textContent = nroItems);
  } else {
    badgeNav && badgeNav.classList.add('d-none');
    badgeCart && badgeCart.classList.add('d-none');
  }

  const descuento = totalBase - totalDescuento;
  const descEl    = document.querySelector('.descuentoPedidoPorMayor');
  if (descuento > 0.001) {
    descEl?.classList.remove('d-none');
    const cantEl = document.querySelector('.cantidadDescuentoPedidoPorMayor');
    if (cantEl) cantEl.textContent = formatearMonto(descuento);
  } else {
    descEl?.classList.add('d-none');
  }

  const totalBaseEl = document.querySelector('.cantidadTotalBase');
  const totalDescEl = document.querySelector('.cantidadTotalDescuento');
  if (totalBaseEl) totalBaseEl.textContent = formatearMonto(totalBase);
  if (totalDescEl) totalDescEl.textContent = formatearMonto(totalDescuento);
}

/**
 * Actualiza el badge del carrito en el navbar.
 */
function actualizarBadgeCarrito() {
  const carrito  = leerCarrito();
  const total    = Object.values(carrito.productos || {}).reduce((s, p) => s + (p.cantidad || 0), 0);
  const badge    = document.getElementById('badgeCarritoNav');
  const badgeCart = document.querySelector('.nroItemsPedido');
  if (total > 0) {
    badge && badge.classList.remove('d-none');
    badge && (badge.textContent = total);
    badgeCart && badgeCart.classList.remove('d-none');
    badgeCart && (badgeCart.textContent = total);
  } else {
    badge && badge.classList.add('d-none');
    badgeCart && badgeCart.classList.add('d-none');
  }
}

function formatearMonto(valor) {
  return parseFloat(valor || 0).toFixed(2);
}

// #endregion

// #region [CATÁLOGO — CARGA Y RENDERIZADO GRID]

/**
 * Obtiene los productos del endpoint público y los renderiza.
 */
async function cargarCatalogo() {
  try {
    const fd = new FormData();
    fd.append('accion', 'listarCatalogo');

    const res  = await fetch(API_ECOMMERCE, { method: 'POST', body: fd });
    const data = await res.json();

    if (data?.icono === 'error') {
      mostrarEstadoCatalogo('vacio');
      return;
    }

    productosData = Array.isArray(data) ? data : [];

    if (productosData.length === 0) {
      mostrarEstadoCatalogo('vacio');
      return;
    }

    generarFiltrosCategorias(productosData);
    renderizarGridCatalogo(productosData);
    mostrarEstadoCatalogo('grid');
  } catch (err) {
    console.error('Error cargando catálogo:', err);
    mostrarEstadoCatalogo('vacio');
  }
}

function mostrarEstadoCatalogo(estado) {
  const loading = document.getElementById('catalogoLoadingState');
  const grid    = document.getElementById('catalogoGridWrapper');
  const vacio   = document.getElementById('catalogoVacioState');

  loading && loading.classList.add('d-none');
  grid    && grid.classList.add('d-none');
  vacio   && vacio.classList.add('d-none');

  if (estado === 'grid') {
    grid && grid.classList.remove('d-none');
  } else if (estado === 'vacio') {
    vacio && vacio.classList.remove('d-none');
  } else {
    loading && loading.classList.remove('d-none');
  }
}

function generarFiltrosCategorias(productos) {
  const categorias = [
    ...new Set(productos.map(p => p.nombre_categoria_producto || 'General'))
  ];
  const contenedor = document.getElementById('filtrosCategorias');
  if (!contenedor) return;

  contenedor.innerHTML = `
    <button class="filtro-btn botonCategoriaItems active" data-cat="todos">Todos</button>
  `;

  categorias.forEach(cat => {
    const btn = document.createElement('button');
    btn.className  = 'filtro-btn botonCategoriaItems';
    btn.dataset.cat = cat;
    btn.textContent = cat;
    contenedor.appendChild(btn);
  });

  contenedor.addEventListener('click', e => {
    const btn = e.target.closest('.botonCategoriaItems');
    if (!btn) return;
    contenedor.querySelectorAll('.botonCategoriaItems').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtrarCatalogo(btn.dataset.cat);
  });
}

/**
 * Renderiza el Grid de Tarjetas del Catálogo Centradas con Ícono SVG.
 */
function renderizarGridCatalogo(productos) {
  const grid = document.getElementById('catalogoGridWrapper');
  if (!grid) return;

  grid.innerHTML = '';

  productos.forEach(prod => {
    const foto = prod.foto_presentacion && prod.foto_presentacion !== ''
      ? FOTOS_BASE + 'presentaciones_productos/' + prod.foto_presentacion
      : './img/aseo-limpieza.jpg';

    const precioDolar = parseFloat(prod.precio_dolar || 0).toFixed(2);
    const precioBS    = parseFloat(prod.precio_bs    || 0).toFixed(2);
    const categoria   = prod.nombre_categoria_producto || 'General';

    const col = document.createElement('div');
    col.className = 'col-sm-6 col-lg-4 col-xl-3 producto-item-wrap';
    col.dataset.cat = categoria;
    col.dataset.nombre = ((prod.nombre_producto || '') + ' ' + (prod.nombre_presentacion || '')).toLowerCase();

    col.innerHTML = `
      <div class="producto-card shadow-sm h-100">
        <div class="producto-card-img-wrap">
          <span class="producto-card-badge">${escaparHTML(categoria)}</span>
          <img src="${escaparHTML(foto)}" alt="${escaparHTML(prod.nombre_producto || '')}" class="producto-card-img" onerror="this.onerror=null;this.src='./img/logo-footer.png'">
        </div>
        <div class="producto-card-body">
          <h5 class="producto-card-title">${escaparHTML(prod.nombre_producto || '')}</h5>
          <p class="producto-card-pres mb-2">Presentación: ${escaparHTML(prod.nombre_presentacion || 'Unidad')}</p>

          <div class="producto-card-prices">
            <span class="precio-usd-tag">$${precioDolar}</span>
            <span class="precio-bs-tag">/ ${precioBS} Bs</span>
          </div>

          <button class="btn btn-dark w-100 rounded-pill py-2 fw-bold btnAggProdCarritoPagina shadow-sm d-flex align-items-center justify-content-center gap-2" data-info='${JSON.stringify(prod).replace(/'/g, "&#39;")}'>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span>Añadir al Carrito</span>
          </button>
        </div>
      </div>
    `;

    grid.appendChild(col);
  });
}

function filtrarCatalogo(categoria) {
  const buscador = document.getElementById('buscadorCatalogoPagina');
  const termino  = buscador ? buscador.value.toLowerCase().trim() : '';

  document.querySelectorAll('#catalogoGridWrapper .producto-item-wrap')
    .forEach(col => {
      const catCol = col.dataset.cat || '';
      const texto  = col.dataset.nombre || '';
      const matchCat = categoria === 'todos' || catCol === categoria;
      const matchBus = termino === '' || texto.includes(termino);
      col.style.display = (matchCat && matchBus) ? '' : 'none';
    });
}

function escaparHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// #endregion

// #region [CHATBOT & SECRET KEY]

function abrirChatbotPagina(mensajeInicial) {
  const ventana = document.getElementById('chatbot-window');
  ventana && ventana.classList.remove('d-none');
  if (mensajeInicial) {
    setTimeout(() => enviarMensajeChatbot(mensajeInicial), 300);
  }
}

function enviarSugerenciaChatbot(texto) {
  const input = document.getElementById('chatbot-input');
  if (input) {
    input.value = texto;
    document.getElementById('chatbot-form')?.dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true })
    );
  }
}

function agregarMensajeChatbot(texto, tipo) {
  const contenedor = document.getElementById('chatbot-messages');
  if (!contenedor) return;

  const div = document.createElement('div');
  div.className = tipo === 'bot' ? 'd-flex mb-3' : 'd-flex mb-3 justify-content-end';

  const burbuja = document.createElement('div');
  burbuja.className = tipo === 'bot'
    ? 'bot-msg-bubble bg-white border p-3 shadow-sm'
    : 'user-msg-bubble bg-primary text-white p-3 shadow-sm rounded';
  burbuja.style.maxWidth = '82%';
  burbuja.style.borderRadius = '12px';
  burbuja.innerHTML = escaparHTML(texto)
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  div.appendChild(burbuja);
  contenedor.appendChild(div);
  contenedor.scrollTop = contenedor.scrollHeight;
}

/**
 * Envía el mensaje al chatbot llamando a la Vercel Serverless Function /api/chat.
 * /api/chat lee process.env.CHATBOT_SECRET_KEY del lado del servidor de Vercel
 * y la pinta en las cabeceras HTTP de forma 100% segura sin exponerla al cliente.
 */
async function enviarMensajeChatbot(mensaje) {
  if (!mensaje.trim()) return;
  agregarMensajeChatbot(mensaje, 'user');

  const typing = document.createElement('div');
  typing.id = 'chatbotTyping';
  typing.className = 'd-flex mb-3';
  typing.innerHTML = `
    <div class="bot-msg-bubble bg-white border p-3 shadow-sm" style="border-radius:12px">
      <div class="d-flex gap-1 align-items-center">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  document.getElementById('chatbot-messages')?.appendChild(typing);
  document.getElementById('chatbot-messages')?.scrollTo(0, 999999);

  try {
    let res, data;

    // 1. Intentar llamar al Vercel Serverless Endpoint /api/chat
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: mensaje })
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch {
      // Fallback local/backend si no está en Vercel Serverless
    }

    // 2. Si /api/chat no respondió en el entorno actual, llamar al proxy PHP del ERP
    if (!data || data.error) {
      const fd = new FormData();
      fd.append('accion', 'enviarMensaje');
      fd.append('mensaje', mensaje);

      res = await fetch(API_CHATBOT, {
        method: 'POST',
        body: fd
      });
      data = await res.json();
    }

    document.getElementById('chatbotTyping')?.remove();

    if (data?.respuesta) {
      agregarMensajeChatbot(data.respuesta, 'bot');
    } else if (data?.texto) {
      agregarMensajeChatbot(data.texto, 'bot');
    } else {
      agregarMensajeChatbot('Por favor inicia sesión en el Portal de Clientes para continuar con tu cotización.', 'bot');
    }
  } catch {
    document.getElementById('chatbotTyping')?.remove();
    agregarMensajeChatbot('En este momento no puedo procesar tu solicitud. Contáctanos por WhatsApp al 0424-5085666.', 'bot');
  }
}

// #endregion

// #region [NAVBAR, MENÚ MÓVIL Y CONTACTO]

function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) {
    menu.classList.toggle('active');
  }
}

function enviarContactoWA() {
  const nombre   = document.getElementById('contactoNombre')?.value.trim();
  const telefono = document.getElementById('contactoTelefono')?.value.trim();
  const mensaje  = document.getElementById('contactoMensaje')?.value.trim();

  if (!nombre || !mensaje) {
    alert('Por favor completa tu nombre y mensaje.');
    return;
  }

  const texto = encodeURIComponent(`Hola J. LACRUZ C.A., soy ${nombre} (${telefono || 'sin teléfono'}). Requiero: ${mensaje}`);
  window.open(`https://api.whatsapp.com/send?phone=584245085666&text=${texto}`, '_blank');
}

async function cargarTasaDolar() {
  try {
    const fd = new FormData();
    fd.append('accion', 'listarMonedas');
    const res  = await fetch(API_ECOMMERCE, { method: 'POST', body: fd });
    const data = await res.json();
    if (Array.isArray(data)) {
      const bcv = data.find(m => m.id_moneda == 1 || m.id_moneda == '1');
      if (bcv && bcv.valor_moneda) {
        tasaDolar = parseFloat(bcv.valor_moneda);
      }
    }
  } catch {
    // Tasa por defecto
  }
}

// #endregion

// #region [CAROUSEL Y ANIMACIONES]

let carouselIndex = 0;
let carouselAutoplay = null;
const CARD_WIDTH = 320 + 24;

function iniciarCarrusel() {
  const track = document.getElementById('carouselTrack');
  const outer = document.getElementById('carouselOuter');
  const dots  = document.getElementById('carouselDots');
  if (!track || !outer) return;

  const cards = track.querySelectorAll('.service-card');
  const total = cards.length;
  const visible = Math.floor(outer.clientWidth / CARD_WIDTH) || 1;
  const maxIndex = Math.max(0, total - visible);

  if (dots) {
    dots.innerHTML = '';
    for (let i = 0; i <= maxIndex; i++) {
      const dot = document.createElement('span');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => moverCarrusel(i));
      dots.appendChild(dot);
    }
  }

  function moverCarrusel(idx) {
    carouselIndex = Math.max(0, Math.min(idx, maxIndex));
    track.style.transform = `translateX(-${carouselIndex * CARD_WIDTH}px)`;
    dots && dots.querySelectorAll('.carousel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === carouselIndex);
    });
  }

  carouselAutoplay && clearInterval(carouselAutoplay);
  carouselAutoplay = setInterval(() => {
    moverCarrusel(carouselIndex >= maxIndex ? 0 : carouselIndex + 1);
  }, 4000);
}

function iniciarAnimaciones() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('[data-anim]').forEach(el => {
    observer.observe(el);
  });
}

function iniciarNavbarScroll() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav && nav.classList.toggle('scrolled', window.scrollY > 60);
  });
}

function iniciarMapa() {
  const mapContainer = document.getElementById('mapaContacto');
  if (!mapContainer || typeof L === 'undefined') return;

  const lat = 10.0632758;
  const lng = -69.3170799;

  const map = L.map('mapaContacto').setView([lat, lng], 17);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  const marker = L.marker([lat, lng]).addTo(map);
  marker.bindPopup(`
    <div style="text-align:center;">
      <strong style="color:#0a1628;">J. LACRUZ C.A.</strong><br>
      <small style="color:#64748b;">Barquisimeto, Estado Lara, Venezuela</small><br>
      <a href="https://maps.app.goo.gl/ei45ghyYmUALrw3y9" target="_blank" style="color:#1a56db;font-weight:bold;font-size:11px;">Abrir en Google Maps ↗</a>
    </div>
  `).openPopup();

  map.on('click', () => {
    window.open('https://maps.app.goo.gl/ei45ghyYmUALrw3y9', '_blank');
  });
}

// #endregion

// #region [EVENTOS PRINCIPALES]

document.addEventListener('DOMContentLoaded', async () => {

  iniciarNavbarScroll();
  iniciarAnimaciones();
  iniciarCarrusel();
  iniciarMapa();

  const horaEl = document.getElementById('chatbotHoraInicio');
  if (horaEl) {
    const ahora = new Date();
    const h = String(ahora.getHours()).padStart(2, '0');
    const m = String(ahora.getMinutes()).padStart(2, '0');
    const ampm = ahora.getHours() >= 12 ? 'PM' : 'AM';
    horaEl.textContent = `${h % 12 || 12}:${m} ${ampm}`;
  }

  renderizarOffcanvasCarrito();
  actualizarBadgeCarrito();

  await cargarTasaDolar();
  await cargarCatalogo();

  // Abrir offcanvas del carrito al hacer clic en cualquier botón con data-bs-target="#cartOffcanvas"
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-bs-target="#cartOffcanvas"]');
    if (btn) {
      const cartEl = document.getElementById('cartOffcanvas');
      if (cartEl && typeof bootstrap !== 'undefined') {
        const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(cartEl);
        bsOffcanvas.show();
      }
    }
  });

  // Delegación: Agregar al carrito
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btnAggProdCarritoPagina');
    if (!btn) return;
    try {
      const info = JSON.parse(btn.dataset.info || '{}');
      agregarAlCarrito(info);

      btn.classList.add('btn-success');
      btn.innerHTML = '✔ ¡Agregado!';
      setTimeout(() => {
        btn.classList.remove('btn-success');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <span>Añadir al Carrito</span>
        `;
      }, 1500);

      const cartEl = document.getElementById('cartOffcanvas');
      if (cartEl && typeof bootstrap !== 'undefined') {
        const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(cartEl);
        bsOffcanvas.show();
      }
    } catch (err) {
      console.error('Error al agregar al carrito:', err);
    }
  });

  // Delegación: Cambiar tipo de pago
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btnTipoPago');
    if (!btn) return;
    const panel = btn.closest('.panelCotizacionPedido');
    if (!panel) return;
    panel.querySelectorAll('.btnTipoPago').forEach(b => {
      b.classList.remove('active', 'btn-dark', 'text-white');
      b.classList.add('btn-outline-secondary', 'text-dark', 'border-0', 'bg-light');
    });
    btn.classList.add('active', 'btn-dark', 'text-white');
    btn.classList.remove('btn-outline-secondary', 'text-dark', 'border-0', 'bg-light');
    recalcularTotalesCarrito();
  });

  // Suma
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btnSumItemPedido');
    if (!btn) return;
    const item = btn.closest('.itemPedido');
    if (!item) return;
    const idPres = item.dataset.id_presentacion_producto;
    const carrito = leerCarrito();
    if (carrito.productos?.[idPres]) {
      carrito.productos[idPres].cantidad += 1;
      guardarCarrito(carrito);
      item.querySelector('.cantidadItemCarrito').textContent = carrito.productos[idPres].cantidad;
      recalcularTotalesCarrito();
    }
  });

  // Resta
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btnResItemPedido');
    if (!btn) return;
    const item = btn.closest('.itemPedido');
    if (!item) return;
    const idPres = item.dataset.id_presentacion_producto;
    const carrito = leerCarrito();
    if (carrito.productos?.[idPres]) {
      const cant = carrito.productos[idPres].cantidad;
      if (cant > 1) {
        carrito.productos[idPres].cantidad -= 1;
        guardarCarrito(carrito);
        item.querySelector('.cantidadItemCarrito').textContent = carrito.productos[idPres].cantidad;
        recalcularTotalesCarrito();
      }
    }
  });

  // Eliminar
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btnEliItemPedido');
    if (!btn) return;
    const item = btn.closest('.itemPedido');
    if (!item) return;
    const idPres = item.dataset.id_presentacion_producto;
    const carrito = leerCarrito();
    if (carrito.productos?.[idPres]) {
      delete carrito.productos[idPres];
      guardarCarrito(carrito);
      item.remove();
      renderizarOffcanvasCarrito();
    }
  });

  // Buscador del catálogo
  const buscador = document.getElementById('buscadorCatalogoPagina');
  if (buscador) {
    buscador.addEventListener('input', () => {
      const catActiva = document.querySelector('.botonCategoriaItems.active')?.dataset.cat || 'todos';
      filtrarCatalogo(catActiva);
    });
  }

  // Chatbot toggle
  document.getElementById('chatbot-toggle-btn')?.addEventListener('click', () => {
    const ventana = document.getElementById('chatbot-window');
    ventana && ventana.classList.toggle('d-none');
  });

  document.getElementById('chatbot-close-btn')?.addEventListener('click', () => {
    document.getElementById('chatbot-window')?.classList.add('d-none');
  });

  document.getElementById('chatbot-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('chatbot-input');
    const texto = input?.value.trim();
    if (!texto) return;
    input.value = '';
    await enviarMensajeChatbot(texto);
  });

});

// #endregion