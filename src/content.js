/** Copy in ES (default) and EN. No invented facts. */

export const translations = {
  es: {
    meta: {
      title: "Ignacio Travaglino — Desarrollador general y físico",
      description:
        "Ignacio Travaglino, desarrollador general y físico en Córdoba, Argentina. IA aplicada, sistemas autónomos y pronóstico de series temporales. FAMAF, UNC.",
    },
    skip: "Saltar al contenido",
    nav: {
      work: "Trabajo",
      experience: "Experiencia",
      education: "Formación",
      cv: "CV",
      contact: "Contacto",
      langEs: "Español",
      langEn: "English",
      langGroup: "Idioma",
    },
    hero: {
      kicker: "01  ·  Presentación",
      given: "Ignacio",
      name: "Travaglino",
      title: "Desarrollador general y físico",
      subtitle: "IA aplicada y sistemas autónomos",
      status: "Córdoba · FAMAF · construyendo en el borde",
      location: "Córdoba, Argentina",
      summary:
        "Desarrollador general versátil y matemáticamente riguroso, estudiante de Física de 4.º año, con experiencia en sistemas autónomos, IA aplicada y pronóstico avanzado de series temporales. Altamente adaptable y de aprendizaje notoriamente rápido, impulsado por una pasión profunda por explorar nuevas tecnologías y comprender sistemas complejos. Experiencia traduciendo física teórica y ecuaciones diferenciales a arquitecturas de IA de grado productivo, desplegadas en el borde. Trayectoria construyendo pipelines de navegación autónoma (LiDAR + visión por computadora), agentes de datos a gran escala (RAG con modelos de pesos abiertos) y backends robustos frente a variables altamente inestables.",
      stowe:
        "Invierno 2022–23, Vermont: personal de temporada en Stowe Mountain Resort, programa Work & Travel. 294 km esquiados o en snowboard durante la temporada.",
    },
    work: {
      kicker: "02  ·  Trabajo",
      heading: "Trabajo seleccionado",
      p1Index: "01",
      p1Title: "Sistema de navegación autónoma y robótica en el borde",
      p1Meta: "LiDAR · visión por computadora · Jetson Orin NX · Raspberry Pi 5 · pioneer3at",
      p1Body:
        "Diseño de un sistema completo de navegación autónoma y toma de decisiones con LiDAR y visión por computadora. Pipeline optimizado para hardware de borde con recursos limitados (Jetson Orin NX, Raspberry Pi 5). Validado en simulación robótica virtual (pioneer3at).",
      p2Index: "02",
      p2Title: "Agente RAG local y despliegue de LLM",
      p2Meta: "RAG · embeddings locales · Gemma · Qwen · LiteRT-LM",
      p2Body:
        "Asistente de preguntas y respuestas centrado en privacidad, con RAG, embeddings locales y bases de datos vectoriales. Orquestación de modelos de pesos abiertos (Gemma, Qwen, LiteRT-LM) para consultar documentación interna sin dependencia de APIs externas.",
      p3Index: "03",
      p3Title: "Motores de trading algorítmico cuantitativo",
      p3Meta: "Python · IMC Prosperity 4 · física estadística",
      p3Body:
        "Automatización en Python para sincronizar parámetros en tiempo real con APIs de datos de mercado. Modelos predictivos y algoritmos de trading para IMC Prosperity 4, con física estadística y manejo de datos estocásticos.",
      p4Index: "04",
      p4Title: "Laboratorio doméstico y administración de servidores",
      p4Meta: "Linux · Raspberry Pi 5 · SFTP / WinSCP",
      p4Body:
        "Servidor Linux 24/7 en Raspberry Pi 5. Optimizaciones a nivel de sistema operativo (asignación dinámica de RAM), seguridad y gestión remota de archivos vía SFTP/WinSCP.",
      github: "También en GitHub",
      repoChatbot: "Chatbot",
      repoChatbotMeta: "Python",
      repoFinance: "Financial-Tracker-for-compound-intrest",
      repoElectro: "ELECTRO1",
      repoPagweb: "Pagweb",
      repoPagwebMeta: "JavaScript",
      repoScraper: "scraper",
      repoScraperMeta: "Scraper diario de reseñas e incidencias de relojes Fitbit, con un panel para desarrolladores",
    },
    experience: {
      kicker: "03  ·  Experiencia",
      heading: "Experiencia",
      job1Role: "Desarrollador y arquitecto de pipelines de IA",
      job1Org: "DTA FIO (DTA Logística)",
      job1Place: "Córdoba, Argentina",
      job1Dates: "Agosto 2023 – actualidad",
      job1b1:
        "Arquitectura de pipelines de pronóstico en producción con ARIMA, Prophet y AutoGluon TimeSeries, con mitigación matemática y tratamiento de valores atípicos extremos frente a comportamientos explosivos de los datos.",
      job1b2:
        "Integración de modelos fundacionales de series temporales (Amazon Chronos) y optimización de inferencia paralela con Joblib.",
      job1b3:
        "Impulso de la plataforma Pedido Inteligente para Panificadora Veneziana S.A., procesando un volumen masivo de ventas históricas. Rediseño de la lógica de automatización semanal (cálculos a partir del domingo) y corrección de mapeos de inventario (Stock on Order → órdenes de compra).",
      job1b4:
        "Clasificador de patrones de demanda (estacional, intermitente, estable) para elegir de forma dinámica el modelo óptimo.",
      job2Role: "Personal de temporada",
      job2Org: "Stowe Mountain Resort",
      job2Place: "Stowe, Vermont, EE. UU.",
      job2Dates: "Diciembre 2022 – marzo 2023",
      job2Body:
        "Programa Work & Travel. Intercambio internacional de alta exigencia. 294 km esquiados o en snowboard durante la temporada.",
    },
    education: {
      kicker: "04  ·  Formación",
      heading: "Formación, honores y competencias",
      eduLabel: "Estudios",
      eduDegree: "Licenciatura en Física",
      eduStatus: "En curso, 4.º año. Graduación prevista: 2028.",
      eduSchool: "FAMAF, Universidad Nacional de Córdoba (UNC), Córdoba, Argentina.",
      eduFocusLabel: "Eje",
      eduFocus:
        "Modelado matemático, ecuaciones diferenciales, análisis de sistemas complejos, métodos computacionales avanzados.",
      eduCoursesLabel: "Cursos relevantes",
      eduCourses:
        "Física computacional (simulaciones numéricas de sistemas cuánticos y clásicos), Electrostática, Mecánica analítica.",
      honorsLabel: "Certificaciones, honores, competencias y eventos",
      cqfTitle: "Certificate in Quantitative Finance (CQF)",
      cqfStatus: "Candidato aceptado",
      cqfMeta: "Level 1 · Fitch Learning · abril 2026",
      cqfBody:
        "Cursando Level 1. Cálculo estocástico, derivados, ML cuantitativo, gestión de riesgo financiero.",
      iqcTitle: "International Quant Championship 2026",
      iqcStatus: "Participante seleccionado",
      iqcMeta: "2026",
      iqcBody: "Alfas cuantitativos sobre datos financieros masivos.",
      aiTitle: "U.S. AI Week Córdoba",
      aiStatus: "Asistente",
      aiMeta: "10–11 de agosto de 2026 · Centro Cultural Córdoba, Córdoba, Argentina",
      aiOrg: "Gobierno de los Estados Unidos · Carnegie Mellon University · Gobierno de la Provincia de Córdoba",
      aiBody:
        "Participante de la edición Córdoba (segunda edición; la anterior fue en Buenos Aires). Encuentro internacional de dos días sobre adopción de IA, formación y transferencia tecnológica entre sector público, universidades y empresas. El programa incluyó formación técnica a cargo de especialistas de Carnegie Mellon, feria tecnológica con empresas de EE. UU. y un taller para llevar proyectos de IA de la idea a la implementación.",
      aiPartners: "Acompañaron AmCham Argentina, UVITEC, CACEC y Córdoba Cluster.",
      aiLink: "Nota sobre el encuentro",
      imcTitle: "IMC Prosperity 4",
      imcStatus: "Participación",
      imcMeta: "Trading algorítmico",
      imcBody:
        "Competencia internacional de trading algorítmico; estrategias automatizadas de arbitraje y market-making.",
    },
    skills: {
      kicker: "05  ·  Capacidades",
      heading: "Capacidades",
      g1: "Lenguajes y núcleo",
      g1Body: "Python (Pandas, NumPy, SciKit-Learn, Joblib), SQL, Bash, C/C++ conceptual.",
      g2: "Modelado e IA",
      g2Body:
        "Modelos fundacionales (Amazon Chronos, Gemma, Qwen, LiteRT-LM), RAG, ARIMA/SARIMA, Prophet, NeuralProphet, AutoGluon.",
      g3: "Robótica y borde",
      g3Body:
        "Navegación autónoma, LiDAR, visión por computadora (YOLO), Jetson Orin NX, Raspberry Pi 5, simulación robótica.",
      g4: "Metodologías",
      g4Body:
        "Modelado de sistemas complejos, EDOs numéricas, modelos estocásticos, detección de valores atípicos, clasificación dinámica de patrones.",
      g5: "Herramientas e infraestructura",
      g5Body:
        "Git, Docker (nociones), administración de servidores Linux/Unix, WinSCP, SFTP, automatización de pipelines de datos.",
    },
    contact: {
      kicker: "06  ·  Contacto",
      heading: "Contacto",
      intro: "Córdoba, Argentina.",
      email: "Correo",
      phone: "Teléfono",
      github: "GitHub",
      linkedin: "LinkedIn",
      cv: "Currículum",
      cvHint: "Versión para lectura e impresión",
    },
    footer: {
      copy: "© Ignacio Travaglino",
      colophon:
        "Sitio estático, sin cookies ni analítica. Tipografía: Fraunces e IBM Plex. Pensado para GitHub Pages y Cloudflare Pages.",
    },
    cv: {
      docTitle: "CV — Ignacio Travaglino",
      print: "Descargar / imprimir PDF",
      back: "Volver al sitio",
      summaryLabel: "Perfil",
      workLabel: "Trabajo seleccionado",
      reposLabel: "Repositorios",
      printHint: "El diálogo del sistema permite guardar como PDF (A4 o carta).",
    },
  },
  en: {
    meta: {
      title: "Ignacio Travaglino — General Developer & Physicist",
      description:
        "Ignacio Travaglino, general developer and physicist in Córdoba, Argentina. Applied AI, autonomous systems, and time-series forecasting. FAMAF, UNC.",
    },
    skip: "Skip to content",
    nav: {
      work: "Work",
      experience: "Experience",
      education: "Education",
      cv: "CV",
      contact: "Contact",
      langEs: "Español",
      langEn: "English",
      langGroup: "Language",
    },
    hero: {
      kicker: "01  ·  Introduction",
      given: "Ignacio",
      name: "Travaglino",
      title: "General Developer & Physicist",
      subtitle: "Applied AI & Autonomous Systems",
      status: "Based in Córdoba · FAMAF · building on the edge",
      location: "Córdoba, Argentina",
      summary:
        "Versatile and mathematically rigorous General Developer and 4th-year Physics Student with experience in Autonomous Systems, Applied AI, and Advanced Time-Series Forecasting. Highly adaptable and a notoriously fast learner, driven by a deep passion for exploring new technologies and understanding complex systems. Experienced in translating theoretical physics and differential equations into production-grade, edge-deployed AI architectures. Proven track record building autonomous navigation pipelines (LiDAR + CV), large-scale data agents (RAG using open-weight models), and robust backend pipelines handling highly unstable variables.",
      stowe:
        "Winter 2022–23, Vermont: seasonal staff at Stowe Mountain Resort, Work & Travel program. 294 km skied and snowboarded during the season.",
    },
    work: {
      kicker: "02  ·  Work",
      heading: "Selected work",
      p1Index: "01",
      p1Title: "Autonomous Robotics & Edge Navigation System",
      p1Meta: "LiDAR · computer vision · Jetson Orin NX · Raspberry Pi 5 · pioneer3at",
      p1Body:
        "Designed a complete autonomous navigation and decision-making system using LiDAR + computer vision. Optimized the pipeline for constrained edge hardware (Jetson Orin NX, Raspberry Pi 5). Validated in virtual robotic simulation (pioneer3at).",
      p2Index: "02",
      p2Title: "Local RAG Data Agent & LLM Deployment",
      p2Meta: "RAG · local embeddings · Gemma · Qwen · LiteRT-LM",
      p2Body:
        "Privacy-focused QA assistant with RAG, local embeddings, and vector databases. Orchestrated open-weight models (Gemma, Qwen, LiteRT-LM) to query internal docs with no external API dependency.",
      p3Index: "03",
      p3Title: "Quantitative Algorithmic Trading Engines",
      p3Meta: "Python · IMC Prosperity 4 · statistical physics",
      p3Body:
        "Python automation to sync real-time parameters with market data APIs. Predictive models and trading algorithms for IMC Prosperity 4, using statistical physics and stochastic data handling.",
      p4Index: "04",
      p4Title: "Home Lab & Server Administration",
      p4Meta: "Linux · Raspberry Pi 5 · SFTP / WinSCP",
      p4Body:
        "24/7 Linux server on Raspberry Pi 5. OS-level optimizations (dynamic RAM allocation), security, remote file management via SFTP/WinSCP.",
      github: "Also on GitHub",
      repoChatbot: "Chatbot",
      repoChatbotMeta: "Python",
      repoFinance: "Financial-Tracker-for-compound-intrest",
      repoElectro: "ELECTRO1",
      repoPagweb: "Pagweb",
      repoPagwebMeta: "JavaScript",
      repoScraper: "scraper",
      repoScraperMeta:
        "Daily Fitbit watch review/issue scraper with a developer dashboard",
    },
    experience: {
      kicker: "03  ·  Experience",
      heading: "Experience",
      job1Role: "Developer & AI Pipeline Architect",
      job1Org: "DTA FIO (DTA Logística)",
      job1Place: "Córdoba, Argentina",
      job1Dates: "August 2023 – Present",
      job1b1:
        "Architected production forecasting pipelines using ARIMA, Prophet, and AutoGluon TimeSeries, with mathematical mitigation and extreme outlier handling against explosive data behaviors.",
      job1b2:
        "Integrated foundation time-series models (Amazon Chronos) and optimized parallel inference with Joblib.",
      job1b3:
        "Spearheaded the Pedido Inteligente platform for Panificadora Veneziana S.A., processing massive historical sales data. Redesigned weekly automation logic (calculations starting Sundays) and corrected inventory mappings (Stock on Order → Purchase Orders).",
      job1b4:
        "Built a demand pattern classifier (Seasonal, Intermittent, Stable) to dynamically select the optimal model.",
      job2Role: "Seasonal Staff",
      job2Org: "Stowe Mountain Resort",
      job2Place: "Stowe, Vermont, USA",
      job2Dates: "December 2022 – March 2023",
      job2Body:
        "Work & Travel program. High-demand international exchange. Logged 294 km skied/snowboarded during the season.",
    },
    education: {
      kicker: "04  ·  Education",
      heading: "Education, honors & competitions",
      eduLabel: "Studies",
      eduDegree: "B.Sc. in Physics (Licenciatura en Física)",
      eduStatus: "Ongoing, 4th year. Expected graduation: 2028.",
      eduSchool: "FAMAF, National University of Córdoba (UNC), Córdoba, Argentina.",
      eduFocusLabel: "Core focus",
      eduFocus:
        "Mathematical Modeling, Differential Equations, Complex Systems Analysis, Advanced Computational Methods.",
      eduCoursesLabel: "Relevant coursework",
      eduCourses:
        "Computational Physics (numerical simulations of quantum/classical systems), Electrostatics, Analytical Mechanics.",
      honorsLabel: "Certifications, honors, competitions, and events",
      cqfTitle: "Certificate in Quantitative Finance (CQF)",
      cqfStatus: "Accepted candidate",
      cqfMeta: "Level 1 · Fitch Learning · April 2026",
      cqfBody:
        "Currently enrolled in Level 1. Stochastic calculus, derivatives, quantitative ML, financial risk management.",
      iqcTitle: "International Quant Championship 2026",
      iqcStatus: "Selected participant",
      iqcMeta: "2026",
      iqcBody: "Quantitative alphas on massive financial data.",
      aiTitle: "U.S. AI Week Córdoba",
      aiStatus: "Attendee",
      aiMeta: "10–11 August 2026 · Centro Cultural Córdoba, Córdoba, Argentina",
      aiOrg: "U.S. Government · Carnegie Mellon University · Government of the Province of Córdoba",
      aiBody:
        "Attended the Córdoba edition (second edition; the previous was in Buenos Aires). Two-day international meeting on AI adoption, training, and tech transfer among the public sector, universities, and companies. The program included technical training by Carnegie Mellon specialists, a tech fair with U.S. firms, and a workshop on taking AI projects from idea to implementation.",
      aiPartners: "With AmCham Argentina, UVITEC, CACEC, and Córdoba Cluster as local partners.",
      aiLink: "Event recap",
      imcTitle: "IMC Prosperity 4",
      imcStatus: "Participation",
      imcMeta: "Algorithmic trading",
      imcBody:
        "International algorithmic trading competition; automated arbitrage and market-making strategies.",
    },
    skills: {
      kicker: "05  ·  Skills",
      heading: "Skills",
      g1: "Languages & core",
      g1Body: "Python (Pandas, NumPy, SciKit-Learn, Joblib), SQL, Bash, C/C++ conceptual.",
      g2: "Modeling & AI",
      g2Body:
        "Foundation models (Amazon Chronos, Gemma, Qwen, LiteRT-LM), RAG, ARIMA/SARIMA, Prophet, NeuralProphet, AutoGluon.",
      g3: "Robotics & edge",
      g3Body:
        "Autonomous navigation, LiDAR, Computer Vision (YOLO), Jetson Orin NX, Raspberry Pi 5, robotic simulation.",
      g4: "Methodologies",
      g4Body:
        "Complex systems modeling, numerical DEs, stochastic models, outlier detection, dynamic pattern classification.",
      g5: "Tools & infra",
      g5Body:
        "Git, Docker (basics), Linux/Unix server admin, WinSCP, SFTP, data pipeline automation.",
    },
    contact: {
      kicker: "06  ·  Contact",
      heading: "Contact",
      intro: "Córdoba, Argentina.",
      email: "Email",
      phone: "Phone",
      github: "GitHub",
      linkedin: "LinkedIn",
      cv: "Curriculum vitae",
      cvHint: "Designed for reading and print",
    },
    footer: {
      copy: "© Ignacio Travaglino",
      colophon:
        "Static site, no cookies, no analytics. Type: Fraunces and IBM Plex. Built for GitHub Pages and Cloudflare Pages.",
    },
    cv: {
      docTitle: "CV — Ignacio Travaglino",
      print: "Download / Print PDF",
      back: "Back to site",
      summaryLabel: "Profile",
      workLabel: "Selected work",
      reposLabel: "Repositories",
      printHint: "Use the system dialog to save as PDF (A4 or Letter).",
    },
  },
};
