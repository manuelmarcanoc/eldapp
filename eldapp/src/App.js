import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import Asistente from './Asistente';
import MatchCard from './MatchCard';
import logoApp from './images/silversoft_logo.png';

// --- TU CLAVE API ---
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;


// --------------------

function App() {
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [modoVista, setModoVista] = useState('inicio'); // inicio, lista, lectura
  const [tituloSeccion, setTituloSeccion] = useState('SilverSoft');
  const [listaItems, setListaItems] = useState([]);
  const [contenido, setContenido] = useState('');
  const [cargando, setCargando] = useState(false);

  // Cache para "indexar" (guardar) resultados y no recargar
  const datosCache = useRef({}); // Estructura: { 'marca': [...], 'elpais': [...] }
  const [modeloDetectado, setModeloDetectado] = useState(null); // Aquí guardaremos el nombre real

  // Accesibilidad
  const [tamanoLetra, setTamanoLetra] = useState(22);
  const [contrasteAlto, setContasteAlto] = useState(true);

  // Síntesis de voz
  const synthRef = useRef(window.speechSynthesis);
  const [hablando, setHablando] = useState(false);

  // --- DATOS DE PARTIDOS (AI) ---
  // const [partidos, setPartidos] = useState({ madrid: null, racing: null, valladolid: null });



  const menuOpciones = {
    prensa: [
      { nombre: "20 Minutos", rss: "https://www.20minutos.es/rss" },
      { nombre: "El Mundo", rss: "https://e00-elmundo.uecdn.es/rss/portada.xml" },
      { nombre: "ABC", rss: "https://www.abc.es/rss/2.0/portada/" }
    ],
    deportes: [
      { nombre: "Diario AS", rss: "https://feeds.as.com/mrss-s/pages/as/site/as.com/portada/" }
    ],
    cantabria: [
      { nombre: "El Diario Cantabria", rss: "https://eldiariocantabria.publico.es/rss" },
      { nombre: "Esquelas Cantabria", tipo: "esquelas_parser" }
    ],
    enciclopedia: [
      { nombre: "Wikipedia (Voz)", tipo: "wikipedia_trigger" }
    ]
  };

  const leerRespuesta = (texto) => {
    window.speechSynthesis.cancel();
    const voz = new SpeechSynthesisUtterance(texto);
    voz.lang = 'es-ES';
    voz.rate = 0.9;
    window.speechSynthesis.speak(voz);
  };

  // --- PASO 1: DETECTAR QUÉ MODELO TIENES ACTIVADO ---
  const encontrarModelo = async () => {
    try {
      console.log("Buscando modelos disponibles...");
      // Pedimos la lista a Google
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      const data = await response.json();

      if (!data.models) throw new Error("No pude obtener la lista de modelos.");

      // Buscamos uno que sirva para generar texto ('generateContent')
      // Preferimos los 'gemini' y evitamos los 'vision' si es solo texto
      const modeloValido = data.models.find(m =>
        m.name.includes('gemini') &&
        m.supportedGenerationMethods.includes('generateContent')
      );

      if (modeloValido) {
        console.log("Modelo encontrado:", modeloValido.name);
        return modeloValido.name.replace('models/', ''); // Limpiamos el nombre
      } else {
        throw new Error("Ningún modelo compatible encontrado.");
      }
    } catch (error) {
      console.error(error);
      return 'gemini-pro'; // Si falla la detección, usamos este por defecto
    }
  };



  // --- PASO 2: USAR ESE MODELO ---
  const consultarGemini = async (pregunta) => {
    let intento = 0;
    const maxIntentos = 3;
    let exito = false;

    while (intento < maxIntentos && !exito) {
      try {
        intento++;
        let modeloAUsar = modeloDetectado;

        // Si es la primera vez, buscamos el modelo
        if (!modeloAUsar) {
          modeloAUsar = await encontrarModelo();
          setModeloDetectado(modeloAUsar);
        }

        console.log(`Usando modelo: ${modeloAUsar} (Intento ${intento})`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloAUsar}:generateContent?key=${GEMINI_API_KEY}`;

        const ahora = new Date();
        const fechaActual = now => now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const horaActual = now => now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const contexto = `Hoy es ${fechaActual(ahora)} y son las ${horaActual(ahora)}.`;

        const prompt = `
              Contexto: ${contexto}
              Eres un asistente útil y amable.
              Usuario: "${pregunta}"
              Instrucciones: Responde en texto plano (sin símbolos raros), breve (máx 3 frases). Si es hora/fecha usa contexto. Si es fútbol/tiendas di que no tienes internet en vivo.
            `;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        // Si está sobrecargado (503) y nos quedan intentos, esperamos y reintentamos
        if (response.status === 503 && intento < maxIntentos) {
          console.warn("Modelo sobrecargado (503), reintentando...");
          await new Promise(r => setTimeout(r, 2000)); // Esperar 2 segundos
          continue;
        }

        const data = await response.json();

        if (data.error) {
          // Si el error es de sobrecarga y quedan intentos, reintentamos
          if (data.error.message && (data.error.message.includes('overloaded') || data.error.code === 503) && intento < maxIntentos) {
            console.warn("Modelo sobrecargado (mensaje), reintentando...");
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          throw new Error(data.error.message);
        }

        if (data.candidates && data.candidates[0].content) {
          let respuestaIA = data.candidates[0].content.parts[0].text;
          respuestaIA = respuestaIA.replace(/\*/g, '').replace(/#/g, '');

          setContenido(`
                    <h2>Respuesta</h2>
                    <hr/>
                    <p style="font-size: 1.2em; line-height: 1.6;">${respuestaIA}</p>
                `);
          leerRespuesta(respuestaIA);
          exito = true;
        } else {
          throw new Error("Sin respuesta.");
        }

      } catch (error) {
        console.error(error);
        // Solo mostramos error final si ya gastamos todos los intentos
        if (intento === maxIntentos) {
          setContenido(`
                    <h3>⚠️ ESTAMOS MUY OCUPADOS</h3>
                    <p>Hay mucha gente hablando conmigo ahora.</p>
                    <p>Por favor, inténtalo en un par de minutos.</p>
                `);
          leerRespuesta("Ahora mismo estoy un poco colapsado. Pregúntame en un ratito.");
        }
      }
    }
    setCargando(false);
  };



  // --- CARGADORES ---

  // Helper para intentar varios proxies si uno falla
  const fetchProxy = async (targetUrl) => {
    const proxies = [
      { url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&timestamp=${Date.now()}`, type: 'json' },
      { url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, type: 'text' },
      { url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, type: 'text' }
    ];

    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy.url);
        if (!res.ok) throw new Error(`Proxy error: ${res.status}`);

        let content = "";
        if (proxy.type === 'json') {
          const data = await res.json();
          content = data.contents;
        } else {
          content = await res.text();
        }

        if (content && content.length > 50) return content;
      } catch (e) {
        console.warn(`Fallo proxy ${proxy.url}`, e);
        // Continuamos al siguiente
      }
    }
    throw new Error("Todos los proxies fallaron");
  };

  const cargarEsquelas = async () => {
    // Verificar si ya está en caché
    if (datosCache.current['esquelas']) {
      console.log("Cargando esquelas desde caché.");
      setListaItems(datosCache.current['esquelas']);
      // leerRespuesta("Mostrando esquelas guardadas.");
      return;
    }

    setCargando(true);
    setModoVista('lista');
    setTituloSeccion("ESQUELAS CANTABRIA");
    setListaItems([]);

    const targetUrl = 'https://www.esquelasdecantabria.com/index.php/esquelas';

    try {
      const htmlText = await fetchProxy(targetUrl);

      if (htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        // Usamos un selector más genérico para capturar los enlaces de esquelas
        const enlaces = Array.from(doc.querySelectorAll('a[href*="/esquelas/"]'));

        const esquelas = enlaces.map(enlace => {
          const texto = enlace.innerText.trim();
          const href = enlace.getAttribute('href');

          // Filtros más estrictos
          const esValido = href.includes('/1-esquelas/') &&
            texto.length > 5 &&
            !texto.toUpperCase().includes('IMPRIMIR') &&
            !texto.toUpperCase().includes('EMAIL') &&
            !texto.toUpperCase().includes('ESQUELAS') &&
            !texto.toUpperCase().includes('LEER MÁS') &&
            !texto.toUpperCase().includes('CONTACTAR') &&
            !texto.toUpperCase().includes('SÍGUENOS') &&
            !texto.toUpperCase().includes('CONSULTAR') &&
            !texto.toUpperCase().includes('TWITTER') &&
            !texto.toUpperCase().includes('FACEBOOK') &&
            !texto.toUpperCase().includes('YOUTUBE') &&
            !texto.toUpperCase().includes('AVISO LEGAL') &&
            !texto.toUpperCase().includes('POLÍTICA');

          if (esValido) {
            let ubicacion = "";
            try {
              // Búsqueda robusta del H5 de ubicación (hermano siguiente)
              let currentElement = enlace.parentElement; // Posiblemente H3 o div

              // Buscar en los siguientes hermanos (saltando posibles saltos de línea o elementos vacíos)
              // hasta encontrar un H5 o chocarnos con otro H3 (siguiente esquela)
              let temp = currentElement;
              for (let i = 0; i < 5; i++) { // Límite de búsqueda
                if (!temp) break;
                temp = temp.nextElementSibling;
                if (temp && temp.tagName === 'H5') {
                  let raw = temp.innerText.trim();
                  // Regex para quitar fecha tipo 25-12-2025 al final
                  const matchFecha = raw.match(/(\d{1,2}-\d{1,2}-\d{4})$/);
                  if (matchFecha) {
                    ubicacion = raw.substring(0, matchFecha.index).trim();
                  } else {
                    // Fallback si la fecha está pegada
                    ubicacion = raw.replace(/\d{2}-\d{2}-\d{4}.*$/, '').trim();
                  }
                  // Limpieza guiones finales
                  if (ubicacion.endsWith('-')) ubicacion = ubicacion.slice(0, -1).trim();
                  break;
                }
                if (temp && temp.tagName === 'H3') break; // Ya es otra esquela
              }
            } catch (err) { }

            const tituloFinal = ubicacion ? `† ${texto.toUpperCase()} (${ubicacion.toUpperCase()})` : `† ${texto.toUpperCase()}`;

            return {
              titulo: tituloFinal,
              link: href.startsWith('http') ? href : "https://www.esquelasdecantabria.com" + href,
              esEsquela: true
            };
          }
          return null;
        }).filter(item => item !== null);

        const unicos = esquelas.filter((v, i, a) => a.findIndex(v2 => (v2.titulo === v.titulo)) === i);

        // GUARDAR EN CACHÉ
        datosCache.current['esquelas'] = unicos;

        setListaItems(unicos.length > 0 ? unicos : [{ titulo: "NO SE ENCONTRARON ESQUELAS HOY", contenido: "", esEsquela: true }]);
        // leerRespuesta("He cargado las esquelas de Cantabria.");
      } else {
        setListaItems([{ titulo: "NO SE PUDIERON CARGAR LAS ESQUELAS", contenido: "", esEsquela: true }]);
        leerRespuesta("No se pudieron cargar las esquelas.");
      }
    } catch (error) {
      console.error(error);
      setListaItems([{
        titulo: "ERROR DE CONEXIÓN",
        contenido: "<h3>No se pudieron cargar las esquelas.</h3><p>Intenta de nuevo más tarde.</p>",
        esEsquela: false
      }]);
      leerRespuesta("Error al cargar las esquelas.");
    }
    setCargando(false);
  };

  const cargarFuente = async (fuente) => {
    // 1. Mirar si ya lo tenemos "indexado" (en caché)
    // Usamos el nombre como clave si es esquela, o la URL RSS si es noticia
    const cacheKey = fuente.rss; // Para RSS, la URL es la clave

    if (fuente.tipo === 'esquelas_parser') {
      // Las esquelas tienen su propia función de carga y caché
      await cargarEsquelas();
      setModoVista('lista'); // Asegurarse de que la vista sea lista
      setMenuAbierto(false);
      setBusqueda('');
      return;
    }

    if (fuente.tipo === 'wikipedia_trigger') {
      setModoVista('wikipedia_search');
      setContenido(`
            <h3>ENCICLOPEDIA ACTIVA</h3>
            <p>Pulsa el micrófono y di qué quieres buscar.</p>
            <p>Ejemplo: "Plaza Mayor de Madrid"</p>
        `);
      setTituloSeccion("WIKIPEDIA");
      setMenuAbierto(false);
      leerRespuesta("Modo Enciclopedia activado. Pulsa el botón del micrófono y dime qué buscas.");
      return;
    }

    if (datosCache.current[cacheKey]) {
      console.log("Cargando desde caché (indexado):", cacheKey);
      setTituloSeccion(fuente.nombre.toUpperCase());
      setListaItems(datosCache.current[cacheKey]);
      setModoVista('lista');
      setMenuAbierto(false);
      setBusqueda('');
      setMenuAbierto(false);
      setBusqueda('');
      // leerRespuesta(`Mostrando ${fuente.nombre} guardado.`);
      return;
    }

    // Si no es esquela, seguimos con RSS
    setCargando(true);
    setModoVista('lista');
    setTituloSeccion(fuente.nombre.toUpperCase());
    setListaItems([]);
    setMenuAbierto(false);
    setBusqueda('');

    // Usamos api.rss2json.com para mayor fiabilidad con CORS
    const rss2json = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(fuente.rss)}`;

    try {
      const res = await fetch(rss2json);
      const data = await res.json();

      if (data.status === 'ok') {
        const noticiasAdaptadas = data.items.map(item => {
          const titulo = item.title || "Sin título";
          // Limpiar descripción de etiquetas HTML sobrantes si las hay
          const divTemp = document.createElement("div");
          divTemp.innerHTML = item.description;
          const textoDesc = divTemp.textContent || divTemp.innerText || "";

          let imagen = item.thumbnail;
          if (!imagen && item.enclosure && item.enclosure.link) {
            imagen = item.enclosure.link;
          }

          // Fallback para AS si lo meten en content
          if (!imagen && item.content) {
            const divImg = document.createElement("div");
            divImg.innerHTML = item.content;
            const imgTag = divImg.querySelector("img");
            if (imgTag) imagen = imgTag.src;
          }

          return {
            titulo: titulo.toUpperCase(),
            contenido: `<h3>${titulo}</h3><hr/><p>${textoDesc}</p>`,
            imagen: imagen,
            link: item.link
          };
        }).slice(0, 15);

        // GUARDAR EN CACHÉ
        datosCache.current[cacheKey] = noticiasAdaptadas;
        setListaItems(noticiasAdaptadas);
        leerRespuesta(`He cargado las noticias de ${fuente.nombre}.`);
      } else {
        throw new Error("RSS2JSON falló");
      }
    } catch (e) {
      console.error("Fallo RSS2JSON, intentando proxy fallback...", e);
      try {
        const feedUrl = fuente.rss;
        const xmlStr = await fetchProxy(feedUrl);
        if (xmlStr) {
          const doc = new DOMParser().parseFromString(xmlStr, "text/xml");
          const items = Array.from(doc.querySelectorAll("item"));
          const noticiasAdaptadas = items.map(item => {
            const titulo = item.querySelector("title")?.textContent || "Sin título";
            const desc = item.querySelector("description")?.textContent || "";
            let imagen = item.querySelector("enclosure")?.getAttribute("url");

            if (!imagen) {
              let media = item.getElementsByTagNameNS("*", "content");
              if (media.length > 0) imagen = media[0].getAttribute("url");

              if (!imagen) {
                media = item.getElementsByTagName("media:content");
                if (media.length > 0) imagen = media[0].getAttribute("url");
              }
            }

            const divTemp = document.createElement("div");
            divTemp.innerHTML = desc;
            const textoDesc = divTemp.textContent || divTemp.innerText || "";

            return {
              titulo: titulo.toUpperCase(),
              contenido: `<h3>${titulo}</h3><hr/><p>${textoDesc}</p>`,
              imagen: imagen,
              link: item.querySelector("link")?.textContent
            };
          }).slice(0, 15);

          datosCache.current[cacheKey] = noticiasAdaptadas;
          setListaItems(noticiasAdaptadas);
          datosCache.current[cacheKey] = noticiasAdaptadas;
          setListaItems(noticiasAdaptadas);
          // leerRespuesta(`He cargado las noticias de ${fuente.nombre}.`);
          setCargando(false);
          setCargando(false);
          return;
        }
      } catch (e2) {
        console.error(e2);
        setContenido("NO SE PUDO CARGAR.");
      }
    }

    setCargando(false);
  };

  const cargarDetalleEsquela = async (item) => {
    if (!item.link) return;
    setCargando(true);
    setModoVista('lectura');
    setContenido("<h3>CARGANDO INFORMACIÓN...</h3>");

    try {
      const htmlText = await fetchProxy(item.link);

      if (htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const cuerpo = doc.querySelector('.item-page') || doc.querySelector('[itemprop="articleBody"]') || doc.body;

        if (!cuerpo) throw new Error("No se encontró cuerpo de noticia");

        let htmlFinal = "";
        const hijos = Array.from(cuerpo.children);

        for (let nodo of hijos) {
          const texto = nodo.innerText.toUpperCase();

          // Criterios de PARADA
          if (texto.includes('CONDOLENCIAS') ||
            texto.includes('AYUDA AL USUARIO') ||
            texto.includes('CONTACTAR') ||
            texto.includes('SÍGUENOS') ||
            texto.includes('AVISO DE DERECHOS') ||
            nodo.tagName === 'FORM') {
            break;
          }

          // Criterios de IGNORAR
          if (texto.includes('VOLVER A ESQUELAS') ||
            texto.includes('ENVIAR CONDOLENCIAS') ||
            texto.length < 2) {
            continue;
          }

          // Limpieza interna
          const elementosMalos = nodo.querySelectorAll('button, video, audio, script, iframe');
          elementosMalos.forEach(e => e.remove());

          htmlFinal += nodo.outerHTML;
        }

        if (!htmlFinal) htmlFinal = "<p>No se pudo extraer el texto limpio. Ver web original.</p>";

        setContenido(`<div class="tarjeta-esquela"><div class="datos-esquela">${htmlFinal}</div></div>`);
      }
    } catch (error) {
      console.error("Fallo Detalle:", error);
      setContenido(`<div class="tarjeta-esquela"><h3>${item.titulo}</h3><p>Error al cargar detalle: ${error.message}</p><p>Intenta de nuevo.</p></div>`);
    }
    setCargando(false);
  };

  // --- WIKIPEDIA ---
  const consultarWikipedia = async (consulta) => {
    if (!consulta) return;
    setCargando(true);
    // IMPORTANTE: No cambiamos a 'lectura' para que el buscador siga visible (modo wikipedia_search)
    setContenido("<h3>BUSCANDO EN WIKIPEDIA...</h3><p>Espere un momento...</p>");
    setMenuAbierto(false);

    try {
      // PASO 1: Búsqueda flexible (OpenSearch) para encontrar el título exacto
      const searchUrl = `https://es.wikipedia.org/w/api.php?origin=*&action=opensearch&search=${encodeURIComponent(consulta)}&limit=1&namespace=0&format=json`;

      const resSearch = await fetch(searchUrl);
      const dataSearch = await resSearch.json();

      // dataSearch es [ "query", ["Titulo"], ["desc"], ["url"] ]
      if (!dataSearch[1] || dataSearch[1].length === 0) {
        throw new Error("No encontrado en opensearch");
      }

      const tituloReal = dataSearch[1][0]; // "Guerra civil española"

      // PASO 2: Obtener extracto usando el título exacto
      const contentUrl = `https://es.wikipedia.org/w/api.php?origin=*&action=query&format=json&prop=extracts&explaintext&redirects=1&titles=${encodeURIComponent(tituloReal)}`;

      const resContent = await fetch(contentUrl);
      const dataContent = await resContent.json();

      const pages = dataContent.query?.pages;
      if (!pages) throw new Error("Sin contenido");

      const pageId = Object.keys(pages)[0];
      if (pageId === "-1") throw new Error("Página vacía");

      const page = pages[pageId];
      let textoCompleto = page.extract;

      if (!textoCompleto) throw new Error("Sin texto disponible");

      // Limitar extensión
      if (textoCompleto.length > 2500) {
        textoCompleto = textoCompleto.substring(0, 2500) + "... (y más información no leída).";
      }

      setContenido(`
         <h2>📖 ${page.title.toUpperCase()}</h2>
         <hr/>
         <div style="text-align: left; font-size: 1.1em; line-height: 1.6;">
            <p>${textoCompleto.replace(/\n/g, '<br/><br/>')}</p>
         </div>
      `);

      // Leer
      leerRespuesta(`Aquí tienes información sobre ${page.title}. ` + textoCompleto);

    } catch (e) {
      console.error(e);
      setContenido(`
        <h3>NO ENCONTRADO</h3>
        <p>No encontré "${consulta}" en la enciclopedia.</p>
        <p>Prueba con otras palabras.</p>
      `);
      leerRespuesta(`Lo siento, no he encontrado nada sobre ${consulta}. Intenta decirlo de otra forma.`);
    }
    setCargando(false);
  };

  const procesarPregunta = async (textoEntrada = null) => {
    // ... existente ...
    // Si estamos en modo wikipedia explícito (activado desde menú), redirigimos la voz a wiki
    /* ... lógica se añadirá en cargarFuente ... */
    const consulta = textoEntrada || busqueda;
    if (!consulta) return;

    if (modoVista === 'wikipedia_search') {
      consultarWikipedia(consulta);
      return;
    }

    setCargando(true);
    setModoVista('wikipedia'); // Esto era para Gemini visualmente
    setMenuAbierto(false);
    await consultarGemini(consulta);
  };

  // ...

  const manejarClick = (item) => {
    if (item.esEsquela) {
      if (item.link) cargarDetalleEsquela(item);
    } else {
      setModoVista('lectura');
      setContenido(item.contenido);
    }
  };

  const leerPantalla = () => {
    window.speechSynthesis.cancel();
    const div = document.createElement("div");
    if (modoVista === 'lista') {
      let texto = `LISTA DE ${tituloSeccion}. `;
      listaItems.forEach(n => texto += n.titulo.replace('†', 'Fallecido ') + ". . ");
      div.textContent = texto;
    } else {
      div.innerHTML = contenido;
    }
    leerRespuesta(div.textContent || div.innerText || "");
  };

  const callarVoz = () => { window.speechSynthesis.cancel(); }

  return (
    <div className={`app-contenedor ${contrasteAlto ? 'modo-noche' : 'modo-dia'}`}>

      <header className="barra-superior">
        <div className="sector-izq">
          <button className="btn-menu-hamburguesa" onClick={() => setMenuAbierto(true)}>☰ MENÚ</button>

        </div>
        <div className="sector-centro">
          <img
            src={logoApp}
            alt="ELDAPP Logo"
            style={{
              height: '80px',
              border: 'none',
              margin: '0 auto',
              display: 'block'
            }}
          />
        </div>
        <div className="sector-der">
          <button className="btn-control" onClick={() => setTamanoLetra(t => Math.max(20, t - 2))}>&nbsp;&nbsp;-&nbsp;&nbsp;</button>
          <button className="btn-control" onClick={() => setTamanoLetra(t => t + 2)}>&nbsp;&nbsp;+&nbsp;&nbsp;</button>
          <button className="btn-control btn-modo" onClick={() => setContasteAlto(!contrasteAlto)}>
            {contrasteAlto ? '☀️' : '🌑'}
          </button>
        </div>
      </header>

      {menuAbierto && <div className="fondo-oscuro" onClick={() => setMenuAbierto(false)}></div>}

      <aside className={`menu-lateral ${menuAbierto ? 'abierto' : ''}`}>
        <div className="cabecera-menu">
          <span>SECCIONES</span>
          <button className="btn-cerrar" onClick={() => setMenuAbierto(false)}>✕ CERRAR</button>
        </div>
        <div className="contenido-menu-flexible">
          <div className="bloque-seccion">
            <h3>PRENSA</h3>
            <div className="grid-botones">
              {menuOpciones.prensa.map((p, i) => <button key={i} onClick={() => cargarFuente(p)}>{p.nombre}</button>)}
            </div>
          </div>



          <div className="bloque-seccion">
            <h3>DEPORTES</h3>
            <div className="grid-botones">
              {menuOpciones.deportes.map((p, i) => <button key={i} onClick={() => cargarFuente(p)}>{p.nombre}</button>)}
            </div>
          </div>
          <div className="bloque-seccion destacado">
            <h3>CANTABRIA</h3>
            <div className="grid-botones">
              {menuOpciones.cantabria.map((p, i) => <button key={i} onClick={() => cargarFuente(p)}>{p.nombre}</button>)}
            </div>
          </div>

          <div className="bloque-seccion">
            <h3>ENCICLOPEDIA</h3>
            <div className="grid-botones">
              {menuOpciones.enciclopedia.map((p, i) => <button key={i} onClick={() => cargarFuente(p)}>{p.nombre}</button>)}
            </div>
          </div>

          <button className="btn-volver-inicio" onClick={() => { setModoVista('inicio'); setMenuAbierto(false); setBusqueda('') }}>🏠 INICIO</button>
        </div>
      </aside>

      <main className="area-principal">
        {/* ELEMENTO DE AUDIO ELIMINADO */}

        {(modoVista === 'inicio' || modoVista === 'wikipedia' || modoVista === 'wikipedia_search') && (
          <>
            <div className="buscador-caja">
              <input type="text" placeholder="ESCRIBIR..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && procesarPregunta()} />
              <button className="btn-buscar" onClick={() => procesarPregunta()}>BUSCAR</button>
            </div>

            <Asistente alEscuchar={(texto) => procesarPregunta(texto)} />
          </>
        )}

        {((contenido && modoVista !== 'inicio') || (listaItems.length > 0 && modoVista === 'lista')) && (
          <div className="panel-voz">
            <button onClick={leerPantalla}>🔊 LEER PANTALLA</button>
            <button onClick={callarVoz}>🤫 PARAR</button>
          </div>
        )}

        <div className="visor-texto" style={{ fontSize: `${tamanoLetra}px` }}>
          {cargando && <p className="mensaje-estado">PENSANDO...</p>}

          {!cargando && modoVista === 'inicio' && (
            <div className="bienvenida">
              <p>HOLA.</p>
              <p>PUEDES PREGUNTARME LO QUE QUIERAS.</p>
              <div className="bienvenida">
                <p>HOLA.</p>
                <p>PUEDES PREGUNTARME LO QUE QUIERAS.</p>
              </div>
          )}
            </div>
          )}

          {!cargando && (modoVista === 'wikipedia' || modoVista === 'lectura' || modoVista === 'wikipedia_search') && (
            <div dangerouslySetInnerHTML={{ __html: contenido }} />
          )}

          {!cargando && modoVista === 'lista' && (
            <div className="lista-titulares">
              <h2 className="titulo-periodico">{tituloSeccion}</h2>
              {listaItems.map((item, index) => (
                <button
                  key={index}
                  className="btn-titular"
                  style={{ fontSize: `${tamanoLetra - 2}px` }}
                  onClick={() => manejarClick(item)}
                >
                  {item.imagen && (
                    <img
                      src={item.imagen}
                      alt=""
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        margin: '0',
                        border: '1px solid #ccc',
                        flexShrink: 0
                      }}
                    />
                  )}
                  <span>{item.titulo}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;