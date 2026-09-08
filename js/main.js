/*
 * main.js — Logica de la pagina web publica
 * Catalogo de productos, carrito de pedidos (localStorage), chatbot y mapa interactivo
 */

const HOSTING_URL    = 'https://jlacruzca.com/';
const API_BASE       = window.location.hostname.includes('jlacruzca.com') ? '/' : HOSTING_URL;
const API_ECOMMERCE  = API_BASE + '?views=ecommercePublico';
const API_CHATBOT    = API_BASE + '?views=chatbot';
const FOTOS_BASE     = API_BASE + 'src/assets/fotosModulos/';
const KEY_CARRITO    = 'itemsCarritoPedido';

let tasaDolar = 36.5;
let productosData = [];
let carouselIndex = 0;
let carouselAutoplay = null;

/* Ajuste dinamico de alto de pantalla para moviles y navegadores */
function actualizarViewport() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', actualizarViewport);
window.addEventListener('orientationchange', actualizarViewport);
actualizarViewport();

/* Leer el carrito guardado */
function leerCarrito() {
  try {
    const raw = localStorage.getItem(KEY_CARRITO);
    if (!raw) return { productos: {} };
    return JSON.parse(raw) || { productos: {} };
  } catch {
    return { productos: {} };
  }
}

/* Guardar el carrito */
function guardarCarrito(carrito) {
  localStorage.setItem(KEY_CARRITO, JSON.stringify(carrito));
}

/* Agregar o incrementar producto en el carrito */
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

/* Dibujar los productos en el panel del carrito */
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

/* Recalcular los montos totales del carrito */
function recalcularTotalesCarrito() {
  const panel = document.querySelector('.panelCotizacionPedido');
  if (!panel) return;

  const tipoPagoActivo = panel.querySelector('.btnTipoPago.active')?.dataset.tipo_pago || 'bs';
  const signo = tipoPagoActivo === 'usd' ? '$' : 'Bs';

  const items = panel.querySelectorAll('.itemPedido');

  let sumaBaseUSD  = 0;
  let sumaMayorUSD = 0;

  items.forEach(item => {
    const precioBaseUSD = parseFloat(item.dataset.precio_producto) || 0;
    const cantidad      = parseInt(item.querySelector('.cantidadItemCarrito')?.textContent || '1', 10);
    const cantPmp       = parseInt(item.dataset.cantidad_pmp || '1', 10);

    const precioMayorUSD = cantidad >= cantPmp ? precioBaseUSD * 0.90 : precioBaseUSD;

    const subTotalBaseUSD  = precioBaseUSD * cantidad;
    const subTotalMayorUSD = precioMayorUSD * cantidad;

    sumaBaseUSD  += subTotalBaseUSD;
    sumaMayorUSD += subTotalMayorUSD;

    const factor = tipoPagoActivo === 'usd' ? 1 : tasaDolar;

    const baseItemEl  = item.querySelector('.precioBaseItem');
    const mayorItemEl = item.querySelector('.precioMayorItem');
    if (baseItemEl)  baseItemEl.textContent  = (precioBaseUSD * factor).toFixed(2);
    if (mayorItemEl) mayorItemEl.textContent = (precioBaseUSD * 0.90 * factor).toFixed(2);

    const subBaseEl  = item.querySelector('.cantidadSubTotalBase');
    const subMayorEl = item.querySelector('.cantidadSubTotalDescuento');
    if (subBaseEl)  subBaseEl.textContent  = (subTotalBaseUSD * factor).toFixed(2);
    if (subMayorEl) subMayorEl.textContent = (subTotalMayorUSD * factor).toFixed(2);

    const divSub = item.querySelector('.divSubTotalItemPedido');
    if (divSub) {
      const elBase  = divSub.querySelector('.subTotalBase');
      const elMayor = divSub.querySelector('.subTotalDescuento');

      if (cantidad >= cantPmp && cantPmp > 1) {
        elBase?.classList.add('text-decoration-line-through', 'opacity-50');
        elMayor?.classList.remove('d-none');
      } else {
        elBase?.classList.remove('text-decoration-line-through', 'opacity-50');
        elMayor?.classList.add('d-none');
      }
    }

    item.querySelectorAll('.signoPrecio').forEach(el => el.textContent = signo);
  });

  const factor = tipoPagoActivo === 'usd' ? 1 : tasaDolar;

  const totalBaseFinal  = sumaBaseUSD * factor;
  const totalMayorFinal = sumaMayorUSD * factor;
  const descuentoTotal  = (sumaBaseUSD - sumaMayorUSD) * factor;

  const cantidadTotalBaseEl = panel.querySelector('.cantidadTotalBase');
  const cantidadTotalMayorEl = panel.querySelector('.cantidadTotalDescuento');
  if (cantidadTotalBaseEl)  cantidadTotalBaseEl.textContent  = totalBaseFinal.toFixed(2);
  if (cantidadTotalMayorEl) cantidadTotalMayorEl.textContent = totalMayorFinal.toFixed(2);

  const elTotalBase  = panel.querySelector('.totalBase');
  const elTotalMayor = panel.querySelector('.totalDescuento');
  const rowDescuento = panel.querySelector('.descuentoPedidoPorMayor');

  if (descuentoTotal > 0.01) {
    elTotalBase?.classList.remove('d-none');
    elTotalBase?.classList.add('text-decoration-line-through', 'opacity-50');
    if (rowDescuento) {
      rowDescuento.classList.remove('d-none');
      const cantDescEl = rowDescuento.querySelector('.cantidadDescuentoPedidoPorMayor');
      if (cantDescEl) cantDescEl.textContent = '-' + descuentoTotal.toFixed(2);
    }
  } else {
    elTotalBase?.classList.add('d-none');
    rowDescuento?.classList.add('d-none');
  }

  panel.querySelectorAll('.contenedorTotalPagar .signoPrecio').forEach(el => el.textContent = signo);
}

/* Actualizar la cantidad en el boton del carrito */
function actualizarBadgeCarrito() {
  const carrito = leerCarrito();
  const productos = carrito.productos || {};
  const totalItems = Object.values(productos).reduce((s, p) => s + (p.cantidad || 0), 0);

  const badgeNav  = document.getElementById('badgeCarritoNav');
  const badgePage = document.querySelector('.nroItemsPedido');

  [badgeNav, badgePage].forEach(b => {
    if (!b) return;
    b.textContent = totalItems;
    if (totalItems > 0) {
      b.classList.remove('d-none');
    } else {
      b.classList.add('d-none');
    }
  });
}

/* Cargar tasa del dolar oficial */
async function cargarTasaDolar() {
  try {
    const fd = new FormData();
    fd.append('accion', 'listarMonedas');
    const res = await fetch(API_ECOMMERCE, { method: 'POST', body: fd });
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const bcv = data.find(m => m.nombre_moneda?.toLowerCase().includes('bcv') || m.es_principal === '1');
      if (bcv && parseFloat(bcv.valor_moneda) > 0) {
        tasaDolar = parseFloat(bcv.valor_moneda);
      }
    }
  } catch {
    tasaDolar = 36.5;
  }
}

/* Cargar catalogo desde la base de datos */
async function cargarCatalogo() {
  const loadingEl = document.getElementById('catalogoLoadingState');
  const gridEl    = document.getElementById('catalogoGridWrapper');
  const vacioEl   = document.getElementById('catalogoVacioState');

  try {
    const fd = new FormData();
    fd.append('accion', 'listarCatalogo');
    const res = await fetch(API_ECOMMERCE, { method: 'POST', body: fd });
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      productosData = data;
      renderizarCategorias(productosData);
      renderizarTarjetasCatalogo(productosData);
      loadingEl?.classList.add('d-none');
      gridEl?.classList.remove('d-none');
    } else {
      loadingEl?.classList.add('d-none');
      vacioEl?.classList.remove('d-none');
    }
  } catch (err) {
    console.error('Error al cargar catalogo:', err);
    loadingEl?.classList.add('d-none');
    vacioEl?.classList.remove('d-none');
  }
}

/* Generar botones de filtro por categoria */
function renderizarCategorias(productos) {
  const contenedor = document.getElementById('filtrosCategorias');
  if (!contenedor) return;

  const categorias = new Set();
  productos.forEach(p => {
    if (p.nombre_categoria) categorias.add(p.nombre_categoria.trim());
  });

  contenedor.innerHTML = '<button class="filtro-btn botonCategoriaItems active" data-cat="todos">Todos</button>';

  categorias.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filtro-btn botonCategoriaItems';
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      contenedor.querySelectorAll('.botonCategoriaItems').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtrarCatalogo(cat);
    });
    contenedor.appendChild(btn);
  });
}

/* Filtrar productos por busqueda y categoria */
function filtrarCatalogo(catFiltro) {
  const texto = document.getElementById('buscadorCatalogoPagina')?.value.toLowerCase().trim() || '';

  const filtrados = productosData.filter(p => {
    const coincideCat = catFiltro === 'todos' || p.nombre_categoria?.trim() === catFiltro;
    const coincideTexto = !texto ||
      p.nombre_producto?.toLowerCase().includes(texto) ||
      p.nombre_presentacion?.toLowerCase().includes(texto) ||
      p.nombre_categoria?.toLowerCase().includes(texto);
    return coincideCat && coincideTexto;
  });

  renderizarTarjetasCatalogo(filtrados);
}

/* Renderizar tarjetas del catalogo */
function renderizarTarjetasCatalogo(productos) {
  const gridEl  = document.getElementById('catalogoGridWrapper');
  const vacioEl = document.getElementById('catalogoVacioState');

  if (!gridEl) return;
  gridEl.innerHTML = '';

  if (productos.length === 0) {
    gridEl.classList.add('d-none');
    vacioEl?.classList.remove('d-none');
    return;
  }

  vacioEl?.classList.add('d-none');
  gridEl.classList.remove('d-none');

  productos.forEach(prod => {
    const col = document.createElement('div');
    col.className = 'col-12 col-sm-6 col-md-4 col-lg-3 d-flex align-items-stretch';

    const precioUSD = parseFloat(prod.precio_producto) || 0;
    const precioBs  = (precioUSD * tasaDolar).toFixed(2);

    const fotoUrl = prod.foto_presentacion && prod.foto_presentacion !== ''
      ? FOTOS_BASE + 'presentaciones_productos/' + prod.foto_presentacion
      : './img/aseo-limpieza.jpg';

    const infoObj = JSON.stringify({
      id_producto: prod.id_producto,
      id_presentacion_producto: prod.id_presentacion_producto,
      nombre_producto: prod.nombre_producto,
      nombre_presentacion: prod.nombre_presentacion,
      precio_producto: precioUSD,
      cantidad_pmp: prod.cantidad_pmp || 1,
      foto_presentacion: prod.foto_presentacion || ''
    }).replace(/"/g, '&quot;');

    col.innerHTML = `
      <div class="producto-card w-100">
        <div class="producto-card-img-wrap">
          <span class="producto-card-badge">${escaparHTML(prod.nombre_categoria || 'Suministros')}</span>
          <img src="${fotoUrl}" alt="${escaparHTML(prod.nombre_producto)}" class="producto-card-img" onerror="this.src='./img/aseo-limpieza.jpg'">
        </div>
        <div class="producto-card-body">
          <h5 class="producto-card-title">${escaparHTML(prod.nombre_producto)}</h5>
          <p class="producto-card-pres">${escaparHTML(prod.nombre_presentacion || 'Unidad')}</p>
          <div class="producto-card-prices">
            <span class="precio-usd-tag">$${precioUSD.toFixed(2)}</span>
            <span class="precio-bs-tag">/ ${precioBs} Bs</span>
          </div>
          <button class="btn btn-primary w-100 rounded-pill py-2 btnAggProdCarritoPagina d-flex align-items-center justify-content-center gap-2" data-info="${infoObj}">
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
    gridEl.appendChild(col);
  });
}

/* Escapar caracteres HTML */
function escaparHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Enviar consulta por WhatsApp */
function enviarContactoWA() {
  const nombre   = document.getElementById('contactoNombre')?.value.trim();
  const telefono = document.getElementById('contactoTelefono')?.value.trim();
  const mensaje  = document.getElementById('contactoMensaje')?.value.trim();

  if (!nombre || !telefono || !mensaje) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Por favor complete su nombre, teléfono y mensaje.',
        confirmButtonColor: '#1a56db'
      });
    } else {
      alert('Por favor complete todos los campos.');
    }
    return;
  }

  const textoWA = `Hola J. LACRUZ C.A., mi nombre es *${nombre}* (${telefono}).\n\n*Mensaje:* ${mensaje}`;
  const url = `https://api.whatsapp.com/send?phone=584245085666&text=${encodeURIComponent(textoWA)}`;
  window.open(url, '_blank');
}

/* Alternar menu movil */
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn  = document.getElementById('hamburgerBtn');
  if (menu) {
    const isActive = menu.classList.toggle('active');
    btn && btn.classList.toggle('active', isActive);
    document.body.style.overflow = isActive ? 'hidden' : '';
  }
}

/* Agregar mensaje al chat */
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

/* Enviar mensaje al chatbot */
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
    }

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

/* Enviar sugerencia del chatbot */
function enviarSugerenciaChatbot(texto) {
  enviarMensajeChatbot(texto);
}

/* Carrusel de servicios */
function iniciarCarrusel() {
  const track = document.getElementById('carouselTrack');
  const outer = document.getElementById('carouselOuter');
  const dots  = document.getElementById('carouselDots');
  if (!track || !outer) return;

  const cards = track.querySelectorAll('.service-card');
  if (!cards.length) return;

  function obtenerAnchoCard() {
    return cards[0].offsetWidth + 20;
  }

  function recalcular() {
    const cardWidth = obtenerAnchoCard();
    const visible = Math.floor(outer.clientWidth / cardWidth) || 1;
    const maxIndex = Math.max(0, cards.length - visible);

    if (dots) {
      dots.innerHTML = '';
      for (let i = 0; i <= maxIndex; i++) {
        const dot = document.createElement('span');
        dot.className = 'carousel-dot' + (i === carouselIndex ? ' active' : '');
        dot.addEventListener('click', () => moverCarrusel(i));
        dots.appendChild(dot);
      }
    }
    return { cardWidth, maxIndex };
  }

  function moverCarrusel(idx) {
    const { cardWidth, maxIndex } = recalcular();
    carouselIndex = Math.max(0, Math.min(idx, maxIndex));
    track.style.transform = `translateX(-${carouselIndex * cardWidth}px)`;
    dots && dots.querySelectorAll('.carousel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === carouselIndex);
    });
  }

  window.addEventListener('resize', () => moverCarrusel(carouselIndex));

  carouselAutoplay && clearInterval(carouselAutoplay);
  carouselAutoplay = setInterval(() => {
    const cardWidth = obtenerAnchoCard();
    const visible = Math.floor(outer.clientWidth / cardWidth) || 1;
    const maxIndex = Math.max(0, cards.length - visible);
    moverCarrusel(carouselIndex >= maxIndex ? 0 : carouselIndex + 1);
  }, 4000);

  recalcular();
}

/* Observador de animaciones */
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

/* Efecto de sombra al desplazar la barra de navegacion */
function iniciarNavbarScroll() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav && nav.classList.toggle('scrolled', window.scrollY > 60);
  });
}

/* Inicializar mapa interactivo */
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
      <a href="https://maps.app.goo.gl/ei45ghyYmUALrw3y9" target="_blank" style="color:#1a56db;font-weight:bold;font-size:11px;">Abrir en Google Maps</a>
    </div>
  `).openPopup();

  map.on('click', () => {
    window.open('https://maps.app.goo.gl/ei45ghyYmUALrw3y9', '_blank');
  });
}

/* Eventos al cargar el documento */
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

  document.addEventListener('click', e => {
    const btn = e.target.closest('.btnAggProdCarritoPagina');
    if (!btn) return;
    try {
      const info = JSON.parse(btn.dataset.info || '{}');
      agregarAlCarrito(info);

      btn.classList.add('btn-success');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Agregado</span>
      `;
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

  const buscador = document.getElementById('buscadorCatalogoPagina');
  if (buscador) {
    buscador.addEventListener('input', () => {
      const catActiva = document.querySelector('.botonCategoriaItems.active')?.dataset.cat || 'todos';
      filtrarCatalogo(catActiva);
    });
  }

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