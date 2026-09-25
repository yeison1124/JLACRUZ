/*
 * main.js — Logica de la pagina web corporativa
 * Catalogo de productos y servicios, carrito de pedidos hibrido,
 * checkout integrado, seguimiento de pedidos para clientes, chatbot y mapa interactivo
 */

const BASE_PATH = window.location.pathname.includes('/pagina_empresa')
  ? window.location.pathname.substring(0, window.location.pathname.indexOf('/pagina_empresa') + 1)
  : (window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1));

const API_BASE        = window.location.origin + BASE_PATH;
const API_WEB_EMPRESA = API_BASE + '?views=webEmpresa';
const API_CHATBOT     = API_BASE + '?views=chatbot';
const FOTOS_BASE      = API_BASE + 'src/assets/fotosModulos/';
const EMPRESA_IMG_BASE = API_BASE + 'pagina_empresa/img/';
const KEY_CARRITO     = 'itemsCarritoPedido';

let tasaDolar          = 36.5;
let productosData      = [];
let serviciosData      = [];
let catalogoTipoActivo = 'productos'; // 'productos' | 'servicios'
let clienteSesion      = { autenticado: false, esCliente: false };
let carouselIndex      = 0;
let carouselAutoplay   = null;

/* Ajuste dinamico de alto de pantalla para moviles y navegadores */
function actualizarViewport() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('resize', actualizarViewport);
window.addEventListener('orientationchange', actualizarViewport);
actualizarViewport();

/* Escapar caracteres HTML para prevenir XSS */
function escaparHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ========================================================
   MANEJO DEL CARRITO DE COMPRAS (LOCALSTORAGE)
   ======================================================== */

/* Leer el carrito guardado */
function leerCarrito() {
  try {
    const raw = localStorage.getItem(KEY_CARRITO);
    if (!raw) return { productos: {}, servicios: {} };
    const parsed = JSON.parse(raw) || {};
    if (!parsed.productos) parsed.productos = {};
    parsed.servicios = {}; // Los servicios son de cotización personalizada, no entran al carrito
    return parsed;
  } catch {
    return { productos: {}, servicios: {} };
  }
}

/* Guardar el carrito */
function guardarCarrito(carrito) {
  localStorage.setItem(KEY_CARRITO, JSON.stringify(carrito));
}

/* Agregar o incrementar producto en el carrito */
function agregarAlCarrito(infoProducto) {
  const carrito = leerCarrito();
  const id = String(infoProducto.id_presentacion_producto);

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

/* Agregar o incrementar servicio en el carrito */
function agregarServicioAlCarrito(infoServicio) {
  const carrito = leerCarrito();
  const id = String(infoServicio.id_servicio);

  if (!carrito.servicios) carrito.servicios = {};

  if (carrito.servicios[id]) {
    carrito.servicios[id].cantidad += 1;
  } else {
    carrito.servicios[id] = {
      ...infoServicio,
      tipo_item: 'servicios',
      cantidad: 1
    };
  }
  guardarCarrito(carrito);
  renderizarOffcanvasCarrito();
  actualizarBadgeCarrito();
}

/* Dibujar los productos y servicios en el panel del carrito */
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
    carritoVacio?.classList.remove('d-none');
    carritoVacio?.classList.add('d-flex');
    recalcularTotalesCarrito();
    return;
  }

  carritoVacio?.classList.add('d-none');
  carritoVacio?.classList.remove('d-flex');

  // Renderizar Productos
  for (const [idPres, prod] of Object.entries(productos)) {
    const item = molde.cloneNode(true);
    item.classList.remove('d-none', 'moldeItemPedido');
    item.classList.add('itemPedido');

    item.dataset.id_producto              = prod.id_producto || '';
    item.dataset.id_presentacion_producto = idPres;
    item.dataset.tipo_item                = 'productos';
    item.dataset.precio_item              = prod.precio_producto || 0;
    item.dataset.cantidad_pmp             = prod.cantidad_pmp   || 1;

    const foto = prod.foto_presentacion && prod.foto_presentacion !== ''
      ? FOTOS_BASE + 'presentaciones_productos/' + prod.foto_presentacion
      : EMPRESA_IMG_BASE + 'aseo-limpieza.jpg';
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
    const precioBaseUSD = parseFloat(item.dataset.precio_item) || 0;
    const cantidad      = parseInt(item.querySelector('.cantidadItemCarrito')?.textContent || '1', 10);
    const cantPmp       = parseInt(item.dataset.cantidad_pmp || '1', 10);
    const tipoItem      = item.dataset.tipo_item;

    const precioMayorUSD = (tipoItem === 'productos' && cantidad >= cantPmp && cantPmp > 1)
      ? precioBaseUSD * 0.90
      : precioBaseUSD;

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

      if (tipoItem === 'productos' && cantidad >= cantPmp && cantPmp > 1) {
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

  const checkUSD = document.getElementById('checkoutTotalUSD');
  const checkBs  = document.getElementById('checkoutTotalBs');
  if (checkUSD) checkUSD.textContent = `$${sumaMayorUSD.toFixed(2)}`;
  if (checkBs)  checkBs.textContent  = `/ ${(sumaMayorUSD * tasaDolar).toFixed(2)} Bs`;
}

/* Actualizar la cantidad en el boton del carrito */
function actualizarBadgeCarrito() {
  const carrito = leerCarrito();
  const productos = carrito.productos || {};
  const servicios = carrito.servicios || {};

  const totalProds = Object.values(productos).reduce((s, p) => s + (p.cantidad || 0), 0);
  const totalServs = Object.values(servicios).reduce((s, p) => s + (p.cantidad || 0), 0);
  const totalItems = totalProds + totalServs;

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

/* ========================================================
   SERVICIOS API (webEmpresaControlador)
   ======================================================== */

/* Cargar tasa del dolar oficial */
async function cargarTasaDolar() {
  try {
    const fd = new FormData();
    fd.append('accion', 'listarMonedas');
    const res = await fetch(API_WEB_EMPRESA, { method: 'POST', body: fd });
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const bcv = data.find(m => m.nombre_moneda?.toLowerCase().includes('dólar') || m.nombre_moneda?.toLowerCase().includes('dolar') || String(m.id_moneda) === '1');
      if (bcv && parseFloat(bcv.valor_moneda) > 0) {
        tasaDolar = parseFloat(bcv.valor_moneda);
      }
    }
  } catch {
    tasaDolar = 36.5;
  }
}

/* Cargar catalogo de productos desde la base de datos */
async function cargarCatalogo() {
  const loadingEl = document.getElementById('catalogoLoadingState');
  const gridEl    = document.getElementById('catalogoGridWrapper');
  const vacioEl   = document.getElementById('catalogoVacioState');

  try {
    const fd = new FormData();
    fd.append('accion', 'listarCatalogo');
    const res = await fetch(API_WEB_EMPRESA, { method: 'POST', body: fd });
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

/* Cargar catalogo de servicios desde la base de datos */
async function cargarServicios() {
  try {
    const fd = new FormData();
    fd.append('accion', 'listarServicios');
    const res = await fetch(API_WEB_EMPRESA, { method: 'POST', body: fd });
    const data = await res.json();
    if (Array.isArray(data)) {
      serviciosData = data;
      renderizarCarruselServicios(serviciosData);
    } else {
      serviciosData = [];
      renderizarCarruselServicios([]);
    }
  } catch (err) {
    console.error('Error al cargar servicios:', err);
    serviciosData = [];
    renderizarCarruselServicios([]);
  }
}

/* Renderizar tarjetas del carrusel de servicios desde la base de datos */
function renderizarCarruselServicios(servicios) {
  const track = document.getElementById('carouselTrack');
  if (!track) return;
  track.innerHTML = '';

  if (!servicios || servicios.length === 0) {
    track.innerHTML = `
      <div class="text-center py-5 w-100 text-white">
        <p class="mb-0 fw-bold">No hay servicios registrados en este momento.</p>
      </div>
    `;
    return;
  }

  const descripcionesPorDefecto = {
    'jard': 'Corte de césped, poda de árboles, control de malezas y embellecimiento de espacios exteriores.',
    'plom': 'Reparación de tuberías, bombas de agua, detección de fugas y mantenimiento hidroneumático.',
    'elec': 'Instalación de iluminación led, reparación de tableros eléctricos y cableado industrial.',
    'tanque': 'Lavado, desinfección y mantenimiento preventivo de tanques subterráneos y aéreos.',
    'fumig': 'Tratamientos ecológicos y efectivos para la erradicación de plagas e insectos en empresas.',
    'agua': 'Despacho de agua con camiones cisterna y botellones para el sector industrial, comercial y residencial.'
  };

  servicios.forEach(serv => {
    const nomLower = (serv.nombre_servicio || '').toLowerCase();

    // Foto del servicio (subida en el sistema o respaldo temático)
    let foto = EMPRESA_IMG_BASE + 'mantenimiento.jpg';
    if (serv.foto_servicio && serv.foto_servicio.trim() !== '') {
      foto = FOTOS_BASE + 'servicios/' + serv.foto_servicio;
    } else if (nomLower.includes('jard') || nomLower.includes('verde')) {
      foto = EMPRESA_IMG_BASE + 'jardineria.jpeg';
    } else if (nomLower.includes('plom') || nomLower.includes('hidr') || nomLower.includes('tuber')) {
      foto = EMPRESA_IMG_BASE + 'sistemas-hidraulicos.jpg';
    } else if (nomLower.includes('tanque') || nomLower.includes('lavado')) {
      foto = EMPRESA_IMG_BASE + 'tanques.jpeg';
    } else if (nomLower.includes('fumig') || nomLower.includes('plaga')) {
      foto = EMPRESA_IMG_BASE + 'fumigador.png';
    } else if (nomLower.includes('agua') || nomLower.includes('cisterna') || nomLower.includes('botell')) {
      foto = EMPRESA_IMG_BASE + 'botellones.jpg';
    }

    // Descripción informativa
    let desc = 'Servicio profesional garantizado con personal calificado, insumos y equipos de alta eficiencia operativa.';
    for (const [clave, d] of Object.entries(descripcionesPorDefecto)) {
      if (nomLower.includes(clave)) {
        desc = d;
        break;
      }
    }

    const precioUSD = parseFloat(serv.precio_servicio) || 0;
    const precioBs  = (precioUSD * tasaDolar).toFixed(2);

    const infoObj = JSON.stringify({
      id_servicio: serv.id_servicio,
      nombre_servicio: serv.nombre_servicio,
      descripcion_servicio: desc,
      precio_servicio: precioUSD,
      nombre_unidad_medida: serv.nombre_unidad_medida || 'Servicio',
      foto: foto
    }).replace(/"/g, '&quot;');

    const card = document.createElement('div');
    card.className = 'service-card';
    card.innerHTML = `
      <div class="service-card-bg" style="background-image:url('${foto}')"></div>
      <div class="service-card-overlay"></div>
      <div class="service-card-content">
        <h3>${escaparHTML(serv.nombre_servicio)}</h3>
        <p class="service-desc">${escaparHTML(desc)}</p>
        <div class="service-card-footer mt-2 pt-2 border-top border-light border-opacity-25">
          <div class="d-flex align-items-center justify-content-between mb-1">
            <div>
              <span class="text-white-50 d-block" style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.5px;">Tarifa Referencial</span>
              <strong class="text-white fs-6">$${precioUSD.toFixed(2)}</strong>
              <small class="text-white-50" style="font-size:0.75rem;">/ ${precioBs} Bs</small>
            </div>
            <a href="https://api.whatsapp.com/send?phone=584245085666&text=${encodeURIComponent('Hola J. LACRUZ C.A., me gustaría solicitar una inspección y cotización para el servicio de: ' + serv.nombre_servicio)}" target="_blank" class="btn btn-sm btn-outline-light rounded-pill px-3 py-1 fw-bold d-flex align-items-center gap-1 shadow-sm" style="font-size:0.75rem;" title="Solicitar inspección técnica en sitio">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Cotizar</span>
            </a>
          </div>
          <small class="text-white-50 d-block" style="font-size:0.68rem;">
            ℹ️ Costo final sujeto a evaluación técnica en sitio
          </small>
        </div>
      </div>
    `;

    track.appendChild(card);
  });

  iniciarCarrusel();
}

/* Manejo de filtros del catalogo (oculta clasificaciones internas de fabricacion) */
function renderizarCategorias(productos) {
  const contenedor = document.getElementById('filtrosCategorias');
  if (contenedor) contenedor.innerHTML = '';
}

/* Filtrar productos por busqueda de texto (nombre y presentacion) */
function filtrarCatalogo() {
  const texto = document.getElementById('buscadorCatalogoPagina')?.value.toLowerCase().trim() || '';

  const filtrados = productosData.filter(p => {
    return !texto ||
      p.nombre_producto?.toLowerCase().includes(texto) ||
      p.nombre_presentacion?.toLowerCase().includes(texto);
  });
  renderizarTarjetasCatalogo(filtrados);
}

/* Renderizar tarjetas del catalogo de productos */
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
      : EMPRESA_IMG_BASE + 'aseo-limpieza.jpg';

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
          <img src="${fotoUrl}" alt="${escaparHTML(prod.nombre_producto)}" class="producto-card-img" onerror="this.src='${EMPRESA_IMG_BASE}aseo-limpieza.jpg'">
        </div>
        <div class="producto-card-body">
          <h5 class="producto-card-title">${escaparHTML(prod.nombre_producto)}</h5>
          <p class="producto-card-pres mb-2">
            Presentación: <strong class="text-dark">${escaparHTML(prod.nombre_presentacion || 'Unidad')}</strong>
          </p>
          <div class="producto-card-prices mb-3">
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

/* ========================================================
   ESTADO DE SESIÓN DEL CLIENTE
   ======================================================== */

/* Verificar si el usuario actual tiene sesion activa de cliente */
async function verificarSesionCliente() {
  try {
    const fd = new FormData();
    fd.append('accion', 'verificarSesion');
    const res = await fetch(API_WEB_EMPRESA, { method: 'POST', body: fd });
    const data = await res.json();

    const navLogin        = document.getElementById('navBtnLogin');
    const navLogged       = document.getElementById('navUserLogged');
    const mobileGuest     = document.getElementById('mobileUserGuest');
    const mobileLogged    = document.getElementById('mobileUserLogged');
    const btnCartLogin    = document.getElementById('btnCartLogin');
    const btnCartProcesar = document.getElementById('btnCartProcesar');
    const cartFooterHelp  = document.getElementById('cartFooterHelp');

    if (data && data.autenticado && data.esCliente) {
      clienteSesion = data;

      // Actualizar Navbar Escritorio
      if (navLogin) navLogin.classList.add('d-none');
      if (navLogged) {
        navLogged.classList.remove('d-none');
        navLogged.classList.add('d-flex');
        const nombreEl = document.getElementById('navNombreCliente');
        if (nombreEl) nombreEl.textContent = (data.nombre || 'Cliente').split(' ')[0];
      }

      // Actualizar Navbar Móvil
      if (mobileGuest) mobileGuest.classList.add('d-none');
      if (mobileLogged) {
        mobileLogged.classList.remove('d-none');
        const mNom = document.getElementById('mobileNombreCliente');
        if (mNom) mNom.textContent = data.nombre || 'Cliente';
      }

      // Actualizar Footer Carrito
      if (btnCartLogin) btnCartLogin.classList.add('d-none');
      if (btnCartProcesar) {
        btnCartProcesar.classList.remove('d-none');
        btnCartProcesar.classList.add('d-flex');
      }
      if (cartFooterHelp) {
        cartFooterHelp.textContent = 'Sesión iniciada como cliente. Tu pedido se enviará al sistema para confirmación inmediata.';
      }

      // Llenar datos en modal checkout
      const checkNom = document.getElementById('checkoutClienteNombre');
      const checkCed = document.getElementById('checkoutClienteCedula');
      if (checkNom) checkNom.textContent = `${data.nombre || ''} ${data.apellido || ''}`.trim() || 'Cliente';
      if (checkCed) checkCed.textContent = `Cédula: ${data.cedula || '-'}`;

    } else {
      clienteSesion = { autenticado: false, esCliente: false };

      if (navLogin) navLogin.classList.remove('d-none');
      if (navLogged) {
        navLogged.classList.add('d-none');
        navLogged.classList.remove('d-flex');
      }
      if (mobileGuest) mobileGuest.classList.remove('d-none');
      if (mobileLogged) mobileLogged.classList.add('d-none');

      if (btnCartLogin) btnCartLogin.classList.remove('d-none');
      if (btnCartProcesar) {
        btnCartProcesar.classList.add('d-none');
        btnCartProcesar.classList.remove('d-flex');
      }
      if (cartFooterHelp) {
        cartFooterHelp.textContent = 'Tu carrito se conservará cuando inicies sesión.';
      }
    }
  } catch (err) {
    console.error('Error al verificar sesión:', err);
  }
}

/* Cerrar sesión del cliente en la web */
async function cerrarSesionCliente() {
  if (typeof Swal !== 'undefined') {
    const confirm = await Swal.fire({
      title: '¿Cerrar sesión?',
      text: '¿Deseas salir del portal de clientes?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1a56db',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar'
    });
    if (!confirm.isConfirmed) return;
  }

  try {
    const fd = new FormData();
    fd.append('accion', 'cerrarSesion');
    const res = await fetch(API_WEB_EMPRESA, { method: 'POST', body: fd });
    const data = await res.json();

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'success',
        title: 'Sesión finalizada',
        text: data.mensaje || 'Has cerrado sesión exitosamente.',
        timer: 1500,
        showConfirmButton: false
      });
    }

    await verificarSesionCliente();
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
  }
}

/* ========================================================
   CHECKOUT & REGISTRO DE PEDIDOS
   ======================================================== */

/* Procesar y enviar pedido del cliente */
async function procesarPedidoWeb(e) {
  e.preventDefault();

  if (!clienteSesion.autenticado || !clienteSesion.esCliente) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Inicio de sesión requerido',
        text: 'Debes iniciar sesión como cliente para procesar tu pedido.',
        confirmButtonText: 'Iniciar Sesión',
        confirmButtonColor: '#1a56db'
      }).then(() => {
        window.location.href = 'usuarios/login';
      });
    } else {
      window.location.href = 'usuarios/login';
    }
    return;
  }

  const carrito = leerCarrito();
  const prods = Object.values(carrito.productos || {});
  const servs = Object.values(carrito.servicios || {});

  if (prods.length === 0 && servs.length === 0) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Carrito vacío',
        text: 'Por favor añade productos o servicios antes de finalizar el pedido.',
        confirmButtonColor: '#1a56db'
      });
    }
    return;
  }

  const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked')?.value || 'delivery';
  const direccion   = document.getElementById('checkoutDireccion')?.value.trim();
  const metodoPago  = document.querySelector('input[name="metodo_pago"]:checked')?.value || 'Pago Móvil / Transferencia';
  const obs         = document.getElementById('checkoutObservaciones')?.value.trim() || '';

  if (tipoEntrega === 'delivery' && !direccion) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: 'Dirección requerida',
        text: 'Por favor indica la dirección de entrega para el despacho.',
        confirmButtonColor: '#1a56db'
      });
    }
    return;
  }

  const submitBtn = document.getElementById('btnConfirmarPedidoWeb');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Registrando pedido...';
  }

  try {
    const fd = new FormData();
    fd.append('accion', 'registrarPedido');
    fd.append('tipo_entrega', tipoEntrega);
    fd.append('direccion_entrega', tipoEntrega === 'delivery' ? direccion : 'Retiro en sede corporativa');
    fd.append('metodo_pago', metodoPago);
    fd.append('observaciones', obs);

    const prodsPayload = prods.map(p => ({
      id_presentacion_producto: p.id_presentacion_producto,
      cantidad: p.cantidad
    }));
    const servsPayload = servs.map(s => ({
      id_servicio: s.id_servicio,
      cantidad: s.cantidad
    }));

    fd.append('productos', JSON.stringify(prodsPayload));
    fd.append('servicios', JSON.stringify(servsPayload));

    const res = await fetch(API_WEB_EMPRESA, { method: 'POST', body: fd });
    const data = await res.json();

    if (data.status === 'success') {
      guardarCarrito({ productos: {}, servicios: {} });
      renderizarOffcanvasCarrito();
      actualizarBadgeCarrito();

      const modalCheckEl = document.getElementById('modalCheckoutPedido');
      if (modalCheckEl && typeof bootstrap !== 'undefined') {
        const bsModal = bootstrap.Modal.getInstance(modalCheckEl);
        bsModal && bsModal.hide();
      }

      const cartEl = document.getElementById('cartOffcanvas');
      if (cartEl && typeof bootstrap !== 'undefined') {
        const bsOff = bootstrap.Offcanvas.getInstance(cartEl);
        bsOff && bsOff.hide();
      }

      if (typeof Swal !== 'undefined') {
        await Swal.fire({
          icon: 'success',
          title: '¡Pedido Registrado con Éxito!',
          html: `Tu pedido <strong>${data.id_orden || data.id_pedido}</strong> ha sido recibido en el sistema.<br>Nuestro equipo confirmará tu orden a la brevedad.`,
          confirmButtonColor: '#1a56db',
          confirmButtonText: 'Ver Estado de mis Pedidos'
        });
      }

      const misPedModalEl = document.getElementById('modalMisPedidos');
      if (misPedModalEl && typeof bootstrap !== 'undefined') {
        const misPedModal = bootstrap.Modal.getOrCreateInstance(misPedModalEl);
        misPedModal.show();
      }
      await cargarMisPedidos();

    } else {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: data.titulo || 'Error al procesar pedido',
          text: data.mensaje || 'Ocurrió un inconveniente al registrar la orden. Por favor intente de nuevo.',
          confirmButtonColor: '#1a56db'
        });
      }
    }

  } catch (err) {
    console.error('Error al registrar pedido:', err);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'No se pudo conectar con el servidor para registrar su pedido.',
        confirmButtonColor: '#1a56db'
      });
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Confirmar y Enviar Pedido';
    }
  }
}

/* ========================================================
   SEGUIMIENTO DE PEDIDOS ("MIS PEDIDOS")
   ======================================================== */

/* Consultar y listar los pedidos del cliente en tiempo real */
async function cargarMisPedidos() {
  const loading = document.getElementById('misPedidosLoading');
  const vacio   = document.getElementById('misPedidosVacio');
  const lista   = document.getElementById('misPedidosLista');

  if (!loading || !vacio || !lista) return;

  loading.classList.remove('d-none');
  vacio.classList.add('d-none');
  lista.classList.add('d-none');
  lista.innerHTML = '';

  try {
    const fd = new FormData();
    fd.append('accion', 'consultarPedidos');
    const res = await fetch(API_WEB_EMPRESA, { method: 'POST', body: fd });
    const data = await res.json();

    loading.classList.add('d-none');

    if (!Array.isArray(data) || data.length === 0) {
      vacio.classList.remove('d-none');
      return;
    }

    lista.classList.remove('d-none');

    data.forEach((p, index) => {
      let badgeClass = 'bg-secondary text-white';
      let icono = '📋';
      const estatus = String(p.status || p.status_pedido);

      if (estatus === '5') {
        badgeClass = 'bg-warning text-dark';
        icono = '⏳';
      } else if (estatus === '7') {
        if (p.cedula_repartidor) {
          badgeClass = 'bg-info text-dark';
          icono = '🛵';
        } else {
          badgeClass = 'bg-primary text-white';
          icono = '📦';
        }
      } else if (estatus === '8') {
        badgeClass = 'bg-success text-white';
        icono = '✅';
      } else if (estatus === '6') {
        badgeClass = 'bg-danger text-white';
        icono = '❌';
      }

      const orderId    = p.id_orden_entrega_presupuesto || p.id_pedido || '';
      const orderDate  = p.fecha_orden_entrega_presupuesto || p.fecha_pedido || '';
      const totalUSD   = p.total_dolar || '0.00';
      const totalBs    = p.total_bs || '0.00';
      const totalItems = p.total_items || ((p.items?.length || 0) + (p.servicios?.length || 0));
      const collapseId = `detallePedido_${index}_${String(orderId).replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Filas de productos ordenados
      let tableRows = '';
      if (Array.isArray(p.items) && p.items.length > 0) {
        tableRows += p.items.map(it => {
          const cant     = parseFloat(it.cantidad_producto) || 1;
          const pDolar   = parseFloat(it.precio_unitario_dolar) || 0;
          const subDolar = parseFloat(it.subtotal_dolar) || (cant * pDolar);
          const subBs    = parseFloat(it.subtotal_bs) || (subDolar * tasaDolar);
          const fotoIt   = it.foto_presentacion && it.foto_presentacion.trim() !== ''
            ? `${FOTOS_BASE}presentaciones_productos/${it.foto_presentacion}`
            : `${EMPRESA_IMG_BASE}aseo-limpieza.jpg`;

          return `
            <tr>
              <td class="py-2">
                <div class="d-flex align-items-center gap-2">
                  <img src="${fotoIt}" class="rounded border" style="width:36px; height:36px; object-fit:cover;" onerror="this.src='${EMPRESA_IMG_BASE}aseo-limpieza.jpg'">
                  <div>
                    <strong class="d-block text-dark">${escaparHTML(it.nombre_producto)}</strong>
                  </div>
                </div>
              </td>
              <td class="text-center py-2">
                <span class="badge bg-light text-dark border">${escaparHTML(it.nombre_presentacion || 'Unidad')}</span>
              </td>
              <td class="text-center py-2 fw-bold text-primary">${cant}</td>
              <td class="text-end py-2 text-muted">$${pDolar.toFixed(2)}</td>
              <td class="text-end py-2 fw-bold text-dark">
                $${subDolar.toFixed(2)}
                <br><small class="text-muted fw-normal" style="font-size:0.7rem;">${subBs.toFixed(2)} Bs</small>
              </td>
            </tr>
          `;
        }).join('');
      }

      // Filas de servicios ordenados (si los hubiese)
      if (Array.isArray(p.servicios) && p.servicios.length > 0) {
        tableRows += p.servicios.map(sv => {
          const cant     = parseFloat(sv.cantidad_servicio) || 1;
          const pDolar   = parseFloat(sv.precio_unitario_dolar) || 0;
          const subDolar = parseFloat(sv.subtotal_dolar) || (cant * pDolar);
          const subBs    = parseFloat(sv.subtotal_bs) || (subDolar * tasaDolar);

          return `
            <tr>
              <td class="py-2">
                <div class="d-flex align-items-center gap-2">
                  <div class="bg-primary bg-opacity-10 text-primary rounded p-1 d-flex align-items-center justify-content-center" style="width:36px; height:36px; font-size:1.1rem;">🛠️</div>
                  <div>
                    <strong class="d-block text-dark">${escaparHTML(sv.nombre_servicio)}</strong>
                    <small class="text-muted" style="font-size:0.72rem;">Servicio</small>
                  </div>
                </div>
              </td>
              <td class="text-center py-2">
                <span class="badge bg-light text-dark border">Servicio</span>
              </td>
              <td class="text-center py-2 fw-bold text-primary">${cant}</td>
              <td class="text-end py-2 text-muted">$${pDolar.toFixed(2)}</td>
              <td class="text-end py-2 fw-bold text-dark">
                $${subDolar.toFixed(2)}
                <br><small class="text-muted fw-normal" style="font-size:0.7rem;">${subBs.toFixed(2)} Bs</small>
              </td>
            </tr>
          `;
        }).join('');
      }

      if (!tableRows) {
        tableRows = '<tr><td colspan="5" class="text-center text-muted py-3 small">Los productos de este pedido se encuentran en verificación.</td></tr>';
      }

      const card = document.createElement('div');
      card.className = 'card border shadow-sm rounded-3 overflow-hidden bg-white';
      card.innerHTML = `
        <div class="card-header bg-white py-3 px-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong class="text-dark d-block fs-6">Orden: #${orderId}</strong>
            <small class="text-muted"><i class="me-1">📅</i>${orderDate}</small>
          </div>
          <span class="badge ${badgeClass} px-3 py-2 rounded-pill fw-bold" style="font-size:0.82rem;">
            ${icono} ${p.estado_texto || 'Desconocido'}
          </span>
        </div>
        <div class="card-body p-3">
          <!-- Barra de progreso del estado -->
          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <small class="fw-bold text-muted" style="font-size:0.75rem; text-transform:uppercase;">Progreso del Pedido</small>
              <small class="fw-bold text-primary" style="font-size:0.75rem;">${p.progreso || 25}%</small>
            </div>
            <div class="progress" style="height: 6px; border-radius: 4px;">
              <div class="progress-bar ${p.progreso === 100 ? 'bg-success' : 'bg-primary'}" role="progressbar" style="width: ${p.progreso || 25}%;"></div>
            </div>
            <small class="text-muted d-block mt-1" style="font-size:0.78rem;">
              ℹ️ ${escaparHTML(p.descripcion_estado || '')}
            </small>
          </div>

          <!-- Notificación de repartidor asignado -->
          ${p.cedula_repartidor ? `
            <div class="alert alert-info py-2 px-3 mb-3 small d-flex align-items-center gap-2 rounded-3 border-0 shadow-sm" style="background-color:#e0f2fe; color:#0369a1;">
              <span class="fs-5">🛵</span>
              <div>
                <strong class="d-block">Repartidor en camino:</strong>
                <span>${escaparHTML(p.repartidor_nombre || 'Asignado a tu despacho')}</span>
              </div>
            </div>
          ` : ''}

          <!-- Fila de Total Gastado y Botón Ver Detalles -->
          <div class="bg-light p-3 rounded-3 d-flex flex-wrap justify-content-between align-items-center gap-2 border">
            <div>
              <span class="text-muted d-block" style="font-size:0.72rem; text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">Total Gastado en este Pedido</span>
              <strong class="text-success fs-5">$${totalUSD}</strong>
              <small class="text-muted ms-1">/ ${totalBs} Bs</small>
            </div>
            <button class="btn btn-outline-primary btn-sm rounded-pill px-3 py-2 fw-bold d-flex align-items-center gap-2 shadow-sm" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span>Ver detalles del pedido</span>
              <span class="badge bg-primary text-white rounded-pill ms-1">${totalItems}</span>
            </button>
          </div>

          <!-- Desglose de Productos Ordenados (Colapsable) -->
          <div class="collapse mt-3" id="${collapseId}">
            <div class="border rounded-3 p-3 bg-white">
              <h6 class="fw-bold text-dark border-bottom pb-2 mb-2 d-flex align-items-center gap-2" style="font-size:0.88rem;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                Productos y Artículos de esta Orden
              </h6>
              <div class="table-responsive">
                <table class="table table-sm align-middle mb-0" style="font-size:0.82rem;">
                  <thead class="table-light">
                    <tr>
                      <th>Producto</th>
                      <th class="text-center">Presentación</th>
                      <th class="text-center">Cant.</th>
                      <th class="text-end">P. Unitario</th>
                      <th class="text-end">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows}
                  </tbody>
                  <tfoot class="table-light border-top">
                    <tr>
                      <th colspan="4" class="text-end fw-bold">Total Final:</th>
                      <th class="text-end fw-bold text-success">$${totalUSD} <small class="text-muted d-block fw-normal" style="font-size:0.72rem;">${totalBs} Bs</small></th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;
      lista.appendChild(card);
    });

  } catch (err) {
    console.error('Error al cargar pedidos:', err);
    loading.classList.add('d-none');
    vacio.classList.remove('d-none');
  }
}

/* ========================================================
   WHATSAPP, MENU MOVIL Y UTILIDADES
   ======================================================== */

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

/* ========================================================
   CHATBOT VIRTUAL
   ======================================================== */

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

function enviarSugerenciaChatbot(texto) {
  enviarMensajeChatbot(texto);
}

/* ========================================================
   CARRUSEL, MAPA Y ANIMACIONES
   ======================================================== */

function iniciarCarrusel() {
  const track = document.getElementById('carouselTrack');
  const outer = document.getElementById('carouselOuter');
  const dots  = document.getElementById('carouselDots');
  if (!track || !outer) return;

  const cards = track.querySelectorAll('.service-card');
  if (!cards.length) return;
  carouselIndex = 0;
  track.style.transform = 'translateX(0px)';

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
      <a href="https://maps.app.goo.gl/ei45ghyYmUALrw3y9" target="_blank" style="color:#1a56db;font-weight:bold;font-size:11px;">Abrir en Google Maps</a>
    </div>
  `).openPopup();

  map.on('click', () => {
    window.open('https://maps.app.goo.gl/ei45ghyYmUALrw3y9', '_blank');
  });
}

/* ========================================================
   INICIALIZACIÓN AL CARGAR EL DOCUMENTO
   ======================================================== */

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
  await cargarServicios();
  await verificarSesionCliente();

  // Abrir offcanvas de carrito
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

  // Agregar producto al carrito desde la tarjeta
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

  // Alternar moneda en el panel del carrito
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

  // Incrementar cantidad de item en carrito
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btnSumItemPedido');
    if (!btn) return;
    const item = btn.closest('.itemPedido');
    if (!item) return;

    const tipoItem = item.dataset.tipo_item;
    const carrito = leerCarrito();

    if (tipoItem === 'productos') {
      const idPres = item.dataset.id_presentacion_producto;
      if (carrito.productos?.[idPres]) {
        carrito.productos[idPres].cantidad += 1;
        guardarCarrito(carrito);
        item.querySelector('.cantidadItemCarrito').textContent = carrito.productos[idPres].cantidad;
      }
    } else {
      const idServ = item.dataset.id_servicio;
      if (carrito.servicios?.[idServ]) {
        carrito.servicios[idServ].cantidad += 1;
        guardarCarrito(carrito);
        item.querySelector('.cantidadItemCarrito').textContent = carrito.servicios[idServ].cantidad;
      }
    }
    recalcularTotalesCarrito();
  });

  // Decrementar cantidad de item en carrito
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btnResItemPedido');
    if (!btn) return;
    const item = btn.closest('.itemPedido');
    if (!item) return;

    const tipoItem = item.dataset.tipo_item;
    const carrito = leerCarrito();

    if (tipoItem === 'productos') {
      const idPres = item.dataset.id_presentacion_producto;
      if (carrito.productos?.[idPres] && carrito.productos[idPres].cantidad > 1) {
        carrito.productos[idPres].cantidad -= 1;
        guardarCarrito(carrito);
        item.querySelector('.cantidadItemCarrito').textContent = carrito.productos[idPres].cantidad;
      }
    } else {
      const idServ = item.dataset.id_servicio;
      if (carrito.servicios?.[idServ] && carrito.servicios[idServ].cantidad > 1) {
        carrito.servicios[idServ].cantidad -= 1;
        guardarCarrito(carrito);
        item.querySelector('.cantidadItemCarrito').textContent = carrito.servicios[idServ].cantidad;
      }
    }
    recalcularTotalesCarrito();
  });

  // Eliminar item del carrito
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btnEliItemPedido');
    if (!btn) return;
    const item = btn.closest('.itemPedido');
    if (!item) return;

    const tipoItem = item.dataset.tipo_item;
    const carrito = leerCarrito();

    if (tipoItem === 'productos') {
      const idPres = item.dataset.id_presentacion_producto;
      if (carrito.productos?.[idPres]) {
        delete carrito.productos[idPres];
      }
    } else {
      const idServ = item.dataset.id_servicio;
      if (carrito.servicios?.[idServ]) {
        delete carrito.servicios[idServ];
      }
    }
    guardarCarrito(carrito);
    item.remove();
    renderizarOffcanvasCarrito();
    actualizarBadgeCarrito();
  });

  // Buscador de productos
  const buscador = document.getElementById('buscadorCatalogoPagina');
  if (buscador) {
    buscador.addEventListener('input', () => {
      filtrarCatalogo();
    });
  }

  // Cambio en modalidad de entrega en modal Checkout
  document.querySelectorAll('input[name="tipo_entrega"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const seccion = document.getElementById('seccionCamposDelivery');
      const txtDir = document.getElementById('checkoutDireccion');
      const cardDel = document.getElementById('cardOptDelivery');
      const cardRet = document.getElementById('cardOptRetiro');

      if (radio.value === 'delivery') {
        seccion?.classList.remove('d-none');
        if (txtDir) txtDir.required = true;
        if (cardDel) cardDel.style.borderColor = 'var(--blue)';
        if (cardRet) cardRet.style.borderColor = '';
      } else {
        seccion?.classList.add('d-none');
        if (txtDir) txtDir.required = false;
        if (cardRet) cardRet.style.borderColor = 'var(--blue)';
        if (cardDel) cardDel.style.borderColor = '';
      }
    });
  });

  // Enviar formulario de checkout
  document.getElementById('formCheckoutPedido')?.addEventListener('submit', procesarPedidoWeb);

  // Cerrar sesión cliente
  document.getElementById('btnCerrarSesionNav')?.addEventListener('click', cerrarSesionCliente);
  document.getElementById('btnCerrarSesionMobile')?.addEventListener('click', cerrarSesionCliente);

  // Cargar mis pedidos al abrir el modal
  const modalMisPedidosEl = document.getElementById('modalMisPedidos');
  if (modalMisPedidosEl) {
    modalMisPedidosEl.addEventListener('show.bs.modal', cargarMisPedidos);
  }

  // Chatbot eventos
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