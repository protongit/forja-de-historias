import type { CombatMode, TTSVoiceEmotion } from '../types/game'

export interface PresetAdventure {
  id: string
  title: string
  subtitle: string
  description: string
  difficulty: 'Fácil' | 'Media' | 'Difícil'
  estimatedTime: string
  icon: string
  setupAnswers: Record<string, string>
  combatMode: CombatMode
  ttsEmotion: TTSVoiceEmotion
  adventureName: string
  character: {
    name: string
    background: string
    traits: string[]
    equipment: string[]
    stats: { name: string; value: number }[]
    skills: { name: string; description: string }[]
    hp: number
    maxHp: number
  }
  quest: {
    title: string
    description: string
    objectives: string[]
  }
  inventory: string[]
  initialJournalEntry?: { title: string; summary: string }
  initialMessage: string
}

export const PRESET_AVENTURAS: PresetAdventure[] = [
  {
    id: 'taberna-dragon',
    title: 'La taberna del dragón',
    subtitle: 'Una aventura de iniciación clásica',
    description: 'Eres un joven aventurero que llega a una aldea fronteriza. Los aldeanos viven aterrorizados por un dragón que ha hecho su guarida en la montaña cercana. Tu misión: investigar, reunir aliados y decidir cómo enfrentarte a la bestia.',
    difficulty: 'Fácil',
    estimatedTime: '30-45 min',
    icon: '🐉',
    setupAnswers: {
      ambientacion: 'Fantasía medieval',
      epoca: 'Medieval',
      ficha: 'Ficha detallada',
      clase: 'Guerrero',
      personalidad: 'Audaz y noble',
      nombre: 'Aldric',
      tipo_aventura: 'Rescate y exploración',
      tono_narrador: 'Épica',
      modo_combate: 'Táctico: con turnos y opciones de acción',
    },
    combatMode: 'tactical',
    ttsEmotion: 'epico',
    adventureName: 'La taberna del dragón',
    character: {
      name: 'Aldric',
      background: 'Aldric creció en una pequeña aldea al pie de las montañas. Desde niño soñó con ser caballero y proteger a los inocentes. Entrenó con la espada de su padre y aprendió a leer el terreno en las colinas. Ahora, con su armadura de cuero y su espada heredada, busca su primera gran aventura.',
      traits: ['Audaz', 'Noble', 'Determinado', 'Leal'],
      equipment: ['Espada de hierro', 'Escudo de madera reforzado', 'Armadura de cuero', 'Capa viajera', 'Cantimplora', '5 monedas de oro'],
      stats: [
        { name: 'Fuerza', value: 4 },
        { name: 'Destreza', value: 3 },
        { name: 'Constitución', value: 4 },
        { name: 'Inteligencia', value: 2 },
        { name: 'Sabiduría', value: 3 },
        { name: 'Carisma', value: 3 },
      ],
      skills: [
        { name: 'Espada y escudo', description: 'Combate cuerpo a cuerpo con técnica y defensa' },
        { name: 'Supervivencia', description: 'Capaz de orientarse y encontrar recursos en la naturaleza' },
        { name: 'Intimidación', description: 'Su presencia imponente hace dudar a sus oponentes' },
        { name: 'Resistencia física', description: 'Puede soportar largas marchas y heridas leves' },
      ],
      hp: 30,
      maxHp: 30,
    },
    quest: {
      title: 'El dragón de la montaña humeante',
      description: 'Los aldeanos de Valleclaro viven aterrorizados. Un dragón joven se ha instalado en la cumbre de la Montaña Humeante y sus incursiones han diezmado los rebaños. El anciano del pueblo ofrece una recompensa a quien resuelva el problema. No todo es lo que parece...',
      objectives: [
        'Investigar en la aldea para recabar información sobre el dragón',
        'Explorar la Montaña Humeante y encontrar la guarida del dragón',
        'Decidir el destino del dragón: enfrentarlo, negociar o buscar una solución alternativa',
      ],
    },
    inventory: ['Mapa de la región', 'Carta de presentación del anciano'],
    initialJournalEntry: { title: 'Llegada a Valleclaro', summary: 'Has llegado a la aldea de Valleclaro. El ambiente es tenso, los aldeanos hablan en susurros sobre el dragón.' },
    initialMessage: `El sol se pone sobre Valleclaro cuando llegas montando tu caballo. La aldea, normalmente bulliciosa, está extrañamente silenciosa. Los pocos aldeanos que ves en la calle caminan con prisa, mirando al cielo de reojo.

En la plaza central, el anciano del pueblo te espera apoyado en su bastón. Al verte, sus ojos se iluminan con una mezcla de esperanza y preocupación.

—Así que eres el aventurero que enviaron —dice con voz temblorosa—. Bienvenido seas, aunque el momento no podría ser peor. Hace tres noches que el dragón bajó de la montaña. Ya perdimos tres rebaños enteros. Los jóvenes quieren enfrentarlo, pero yo... yo he visto dragones antes. No volverán.

Te ofrece un trago de su bota de vino y suspira.

—Pero tú... tú tienes pinta de saber lo que haces. Quédate esta noche en la taberna, descansa, y mañana decidimos cómo proceder. La tabernera te dará habitación gratis de mi parte.

Dicho esto, se retira cojeando hacia su casa, dejándote solo en la plaza vacía.

La taberna "El Dragón Dormido" está al otro lado de la plaza. De sus ventanas sale luz cálida y se escuchan murmullos. {{Ir a la taberna}} {{Explorar la aldea primero}} {{Dirigirte hacia la montaña}}`,
  },
  {
    id: 'bosque-susurrante',
    title: 'El bosque susurrante',
    subtitle: 'Exploración y misterio',
    description: 'Una antigua maldición ha caído sobre el Bosque Susurrante. Los árboles hablan, las sombras se mueven y los viajeros desaparecen. Como explorador enviado por el gremio, deberás descubrir el origen de la maldición y ponerle fin.',
    difficulty: 'Media',
    estimatedTime: '40-60 min',
    icon: '🌲',
    setupAnswers: {
      ambientacion: 'Fantasía oscura',
      epoca: 'Medieval tardío',
      ficha: 'Ficha detallada',
      clase: 'Explorador / Guardabosques',
      personalidad: 'Cauteloso y observador',
      nombre: 'Kaelen',
      tipo_aventura: 'Exploración y misterio',
      tono_narrador: 'Misteriosa',
      modo_combate: 'Narrativo: el GM narra libremente',
    },
    combatMode: 'narrative',
    ttsEmotion: 'misterioso',
    adventureName: 'El bosque susurrante',
    character: {
      name: 'Kaelen',
      background: 'Kaelen es un guardabosques del gremio de exploradores. Ha pasado años recorriendo los rincones más peligrosos del reino. Su ojo entrenado detecta lo que otros pasan por alto, y su arco rara vez falla. Cuando los informes de desapariciones comenzaron a llegar del Bosque Susurrante, sabía que era su deber investigar.',
      traits: ['Observador', 'Cauteloso', 'Reservado', 'Ingenioso'],
      equipment: ['Arco largo', '20 flechas', 'Daga de caza', 'Capa de camuflaje', 'Brújula encantada', 'Diario de campo', 'Cuerda de 15m'],
      stats: [
        { name: 'Fuerza', value: 2 },
        { name: 'Destreza', value: 5 },
        { name: 'Constitución', value: 3 },
        { name: 'Inteligencia', value: 4 },
        { name: 'Sabiduría', value: 4 },
        { name: 'Carisma', value: 2 },
      ],
      skills: [
        { name: 'Rastreo', description: 'Puede seguir huellas y rastros casi invisibles' },
        { name: 'Sigilo', description: 'Se mueve sin ser detectado en entornos naturales' },
        { name: 'Conocimiento de la naturaleza', description: 'Identifica plantas, animales y fenómenos naturales' },
        { name: 'Tiro preciso', description: 'Su puntería con el arco es excepcional, incluso a larga distancia' },
      ],
      hp: 22,
      maxHp: 22,
    },
    quest: {
      title: 'El secreto del Bosque Susurrante',
      description: 'El gremio de exploradores ha perdido contacto con tres equipos enviados al Bosque Susurrante. Los lugareños evitan el bosque desde que empezaron a escucharse voces entre los árboles. Algo antiguo está despertando en el corazón del bosque, y solo alguien con astucia y valor podrá descubrir la verdad.',
      objectives: [
        'Investigar la entrada del bosque y encontrar pistas sobre los equipos perdidos',
        'Adentrarse en el bosque y descubrir el origen de las voces',
        'Romper la maldición o enfrentar a la entidad que la causa',
      ],
    },
    inventory: ['Mapa del Bosque Susurrante', 'Insignia del gremio de exploradores', 'Frasco de luz de luna'],
    initialJournalEntry: { title: 'El encargo del gremio', summary: 'El gremio te ha encomendado investigar el Bosque Susurrante. Tres equipos han desaparecido. Debes descubrir qué ocurre.' },
    initialMessage: `La niebla matina aún se enreda entre los árboles cuando llegas al límite del Bosque Susurrante. Delante de ti, el sendero se adentra entre robles retorcidos cuyas ramas parecen querer alcanzarte.

A tu espalda, el camino de vuelta a la civilización aún es visible. Delante, solo sombras y un silencio incómodo que de vez en cuando se rompe con... ¿susurros?

La entrada del bosque está marcada por un viejo cartel de madera que alguien ha clavado recientemente. Alguien ha escrito con carbón:

"NO ENTRES. ELLOS SIGUEN AQUÍ."

Junto al cartel, hay restos de un campamento abandonado: una tienda rasgada, una taza de hojalata volcada y lo que parece un diario parcialmente quemado.

El encargo del gremio era claro: descubre qué pasó con los equipos perdidos. Pero ahora que estás aquí, frente a la oscuridad del bosque, sientes que el peso de la misión es mayor de lo que imaginabas.

{{Examinar el campamento abandonado}} {{Leer el diario quemado}} {{Adentrarte en el bosque sin más dilación}}`,
  },
  {
    id: 'mazmorra-olvidada',
    title: 'La mazmorra olvidada',
    subtitle: 'Combate y supervivencia',
    description: 'Las minas de Khazad-Dûm fueron cerradas hace siglos tras un desastre. Pero hace unos días, se han visto luces en las entrañas de la montaña. Tu grupo de aventureros decide explorar las profundidades en busca de tesoros perdidos... y la verdad sobre lo que realmente ocurrió.',
    difficulty: 'Difícil',
    estimatedTime: '45-90 min',
    icon: '⛏️',
    setupAnswers: {
      ambientacion: 'Fantasía épica',
      epoca: 'Medieval',
      ficha: 'Ficha detallada',
      clase: 'Ladrón / Pícaro',
      personalidad: 'Astuto y ambicioso',
      nombre: 'Sombra',
      tipo_aventura: 'Exploración y combate',
      tono_narrador: 'Grave y misteriosa',
      modo_combate: 'Táctico: con turnos y opciones de acción',
    },
    combatMode: 'tactical',
    ttsEmotion: 'grave',
    adventureName: 'La mazmorra olvidada',
    character: {
      name: 'Sombra',
      background: 'Nadie conoce el verdadero nombre de Sombra. Creció en los callejones de la Ciudad Alta, donde aprendió que la astucia vale más que la fuerza. Su talento para encontrar caminos donde no los hay y su habilidad para sortear trampas la han convertido en la exploradora más solicitada —y mejor pagada— del gremio.',
      traits: ['Astuto', 'Ambicioso', 'Ágil', 'Desconfiado'],
      equipment: ['Dagas gemelas', 'Palanca de forzar', '10 ganzúas', 'Cuerda con gancho', 'Antorchas (3)', 'Bolsa de gemas (vacía)', 'Amuleto de sombras'],
      stats: [
        { name: 'Fuerza', value: 2 },
        { name: 'Destreza', value: 5 },
        { name: 'Constitución', value: 2 },
        { name: 'Inteligencia', value: 4 },
        { name: 'Sabiduría', value: 3 },
        { name: 'Carisma', value: 4 },
      ],
      skills: [
        { name: 'Abrir cerraduras', description: 'Experta en mecanismos de seguridad, incluso los más complejos' },
        { name: 'Sigilo', description: 'Se mueve como una sombra, casi invisible en la oscuridad' },
        { name: 'Detectar trampas', description: 'Su ojo entrenado identifica mecanismos ocultos y trampas' },
        { name: 'Carisma engañoso', description: 'Sabe mentir, persuadir y negociar con una sonrisa' },
      ],
      hp: 18,
      maxHp: 18,
    },
    quest: {
      title: 'Las profundidades de Khazad-Dûm',
      description: 'Las minas de Khazad-Dûm fueron el orgullo del reino enano hasta que algo despertó en sus profundidades. Selladas durante siglos, las últimas noches se han visto extrañas luces azuladas emerger de sus túneles. El consejo de la ciudad ofrece una fortuna a quien explore las minas y regrese con respuestas. Pero en las profundidades, el oro no es lo único que brilla...',
      objectives: [
        'Penetrar en las minas selladas y establecer un campamento base',
        'Explorar los niveles inferiores y descubrir el origen de las luces',
        'Recuperar al menos un artefacto de valor y salir con vida',
      ],
    },
    inventory: ['Mapa parcial de las minas', 'Linterna mágica', 'Cuerda de escalada (20m)', 'Raciones de emergencia (3 días)'],
    initialJournalEntry: { title: 'Entrada a las minas', summary: 'Ante ti se alza la entrada sellada de Khazad-Dûm. Los símbolos enanos brillan débilmente. La aventura comienza.' },
    initialMessage: `La noche es cerrada cuando llegas ante la entrada de las minas de Khazad-Dûm. La luz de la luna apenas ilumina los imponentes pilares de piedra tallada que flanquean la puerta. Los símbolos enanos, oscurecidos por siglos de abandono, brillan de vez en cuando con un tenue resplandor azulado.

Frente a ti, la puerta principal está sellada con un enorme bloque de piedra. Pero tu ojo entrenado detecta un pasadizo lateral, parcialmente oculto por la maleza. También notas que hay inscripciones en la puerta principal que parecen contar una historia.

El aire que sale de las grietas es frío y huele a metal y tierra húmeda. Algo se mueve ahí dentro. Lo oyes.

El consejo de la ciudad pagó bien por esto. La bolsa de gemas en tu cinturón está vacía, lista para llenarse. Pero mientras observas las sombras que bailan detrás de las rejas de la entrada lateral, te preguntas si el tesoro vale lo que sea que haya despertado en las profundidades.

{{Examinar la puerta principal}} {{Buscar el pasadizo lateral}} {{Leer las inscripciones enanas}}`,
  },
  {
    id: 'mansion-ecos',
    title: 'La mansión de los ecos',
    subtitle: 'Terror y misterio gótico',
    description: 'Una mansión victoriana abandonada en las afueras de la ciudad alberga un secreto que nadie se atreve a investigar. Los vecinos escuchan susurros en las noches de luna llena. Como investigador del Paranormal, tu misión es adentrarte y descubrir qué oscuro poder habita sus paredes.',
    difficulty: 'Media',
    estimatedTime: '35-50 min',
    icon: '🏚️',
    setupAnswers: {
      ambientacion: 'Terror gótico',
      epoca: 'Victoriana',
      ficha: 'Ficha detallada',
      clase: 'Investigador paranormal',
      personalidad: 'Escéptico pero valiente',
      nombre: 'Eleanor',
      tipo_aventura: 'Exploración y terror',
      tono_narrador: 'Terrorífica',
      modo_combate: 'Narrativo: el GM narra libremente',
    },
    combatMode: 'narrative',
    ttsEmotion: 'terrorifico',
    adventureName: 'La mansión de los ecos',
    character: {
      name: 'Eleanor',
      background: 'Eleanor Voss creció en una familia de académicos escépticos. Tras la desaparición de su hermano menor durante una investigación paranormal, dedicó su vida a estudiar lo inexplicable con métodos científicos. Su laboratorio portátil y su cámara deConfigurationException son sus herramientas más preciadas.',
      traits: ['Escéptica', 'Valiente', 'Metódica', 'Resiliente'],
      equipment: ['Linterna de carburo', 'Cámara fotográfica', 'Cuaderno de notas', 'Cruz de plata (regalo de su abuela)', 'Kit de análisis químico', 'Reloj de bolsillo', 'Carta de su hermano desaparecido'],
      stats: [
        { name: 'Inteligencia', value: 5 },
        { name: 'Sabiduría', value: 4 },
        { name: 'Carisma', value: 3 },
        { name: 'Destreza', value: 2 },
        { name: 'Fuerza', value: 2 },
        { name: 'Constitución', value: 3 },
      ],
      skills: [
        { name: 'Investigación', description: 'Analiza pistas y conexiones que otros pasan por alto' },
        { name: 'Conocimiento oculto', description: 'Identifica entidades, rituales y fenómenos paranormales' },
        { name: 'Resolución de acertijos', description: 'Resuelve enigmas lógicos y mecanismos ocultos' },
        { name: 'Voluntad férrea', description: 'Resiste el terror y la manipulación mental' },
      ],
      hp: 16,
      maxHp: 16,
    },
    quest: {
      title: 'Los susurros de Blackwood Manor',
      description: 'La Mansión Blackwood lleva 40 años abandonada. Desde que su último dueño, el occultista Cornelius Blackwood, desapareció misteriosamente, nadie se ha atrevido a cruzar su umbral. Los vecinos reportan luces extrañas, susurros en noches de luna llena y una presencia que se siente observar desde las ventanas rotas. Tu hermano desapareció aquí hace tres meses. Es hora de descubrir la verdad.',
      objectives: [
        'Explorar la mansión y documentar los fenómenos paranormales',
        'Descubrir qué le pasó a tu hermano y al último dueño de la mansión',
        'Encontrar la fuente del poder oscuro y decidir cómo enfrentarla',
      ],
    },
    inventory: ['Linterna de carburo', 'Cámara fotográfica', 'Cuaderno de notas', 'Cruz de plata', 'Carta de tu hermano'],
    initialJournalEntry: { title: 'Llegada a Blackwood Manor', summary: 'La mansión se alza ante ti, silenciosa y macabra. Las ventanas rotas parecen ojos que te observan. El aire huele a polvo y algo más... algo antiguo.' },
    initialMessage: `El carruaje te deja en la entrada del camino que lleva a Blackwood Manor. El conductor no se atreve a acercarse más. "Aquí me espero", murmura con los ojos fijos en la niebla que se arrastra entre los árboles.

La mansión se alza al final del camino, una silueta negra contra el cielo plomizo. Sus ventanas rotas parecen cuencas vacías que te observan. Un portón de hierro oxidado marca la entrada al jardín, medio sepultado por la maleza.

Al acercarte, sientes que el aire se enfría varios grados. Tu hermano desapareció aquí hace tres meses. La última carta que recibiste decía: "He encontrado algo extraordinario en el sótano. Los ecos no son lo que parecen."

El portón cruje cuando lo empujas. El camino hacia la mansión está flanqueado por estatuas de ángeles cuyos rostros han sido erosionados por el tiempo. O al menos... eso esperas que sea erosión.

{{Examinar las estatuas del camino}} {{Ir directamente a la puerta principal}} {{Revisar el jardín abandonado}}`,
  },
  {
    id: 'neon-almas',
    title: 'Neón y almas',
    subtitle: 'Ciberdelito en la megaestructura',
    description: 'En Neo-Shangai 2087, una corporación ha desarrollado una IA capaz de extraer y vender recuerdos humanos. Como hacker freelance, recibes una oferta millonaria: infiltrarte en sus servidores y liberar a las conciencias atrapadas. Pero en el mundo del ciberespacio, nada es lo que parece.',
    difficulty: 'Media',
    estimatedTime: '40-60 min',
    icon: '🌃',
    setupAnswers: {
      ambientacion: 'Cyberpunk',
      epoca: 'Futurista (2087)',
      ficha: 'Ficha detallada',
      clase: 'Hacker / Netrunner',
      personalidad: 'Astuto y rebelde',
      nombre: 'Zero',
      tipo_aventura: 'Infiltración y descubrimiento',
      tono_narrador: 'Misteriosa',
      modo_combate: 'Táctico: con turnos y opciones de acción',
    },
    combatMode: 'tactical',
    ttsEmotion: 'misterioso',
    adventureName: 'Neón y almas',
    character: {
      name: 'Zero',
      background: 'Zero no es su nombre real. Nadie lo recuerda. Creció en los niveles inferiores de la megaestructura, donde los niños hackers aprenden a sobrevivir hackeando terminales de basura. Ahora es uno de los netrunners más buscados del bajo mundo, especializado en infiltración de corporaciones. Su mente conectada es su arma más letal.',
      traits: ['Astuto', 'Rebelde', 'Pragmático', 'Desconfiado'],
      equipment: ['Cyberdeck militarizado', 'Cables de interfaz neural', 'Pistola láser compacta', 'Chaleco anticorriente', 'Visor de realidad aumentada', '10 monedas de cripto', 'Tarjeta de identidad falsa'],
      stats: [
        { name: 'Inteligencia', value: 5 },
        { name: 'Destreza', value: 4 },
        { name: 'Carisma', value: 3 },
        { name: 'Constitución', value: 2 },
        { name: 'Fuerza', value: 2 },
        { name: 'Sabiduría', value: 3 },
      ],
      skills: [
        { name: 'Hacking', description: 'Infiltra sistemas corporativos y manipula redes de datos' },
        { name: 'Sigilo digital', description: 'Se mueve por el ciberespacio sin ser detectado' },
        { name: 'Improvisación', description: 'Adapta gadgets y recursos para resolver problemas' },
        { name: 'Cara de póker', description: 'Mantiene la calma bajo presión y engaña con facilidad' },
      ],
      hp: 14,
      maxHp: 14,
    },
    quest: {
      title: 'El Proyecto Mnemotecnia',
      description: 'La corporación Synapse Corp ha desarrollado "Mnemotecnia": una tecnología que extrae recuerdos humanos y los convierte en datos vendibles. Miles de personas han sido conectadas a sus "cápsulas de memoria" sin saber que sus recuerdos más íntimos están siendo subastados en la darknet. Una clienta anónima te ofrece 50.000 criptos por infiltrarte en el centro de datos principal y liberar las conciencias atrapadas.',
      objectives: [
        'Infiltrarte en la Synapse Corp a través de sus terminales de seguridad',
        'Descubrir la ubicación del servidor principal de Mnemotecnia',
        'Liberar las conciencias atrapadas y decidir el destino de la tecnología',
      ],
    },
    inventory: ['Cyberdeck militarizado', 'Tarjeta de identidad falsa', 'Cables de interfaz neural', 'Visor de realidad aumentada'],
    initialJournalEntry: { title: 'El encargo', summary: 'Una clienta anónima te contacta a través de un canal encriptado. Synapse Corp. Proyecto Mnemotecnia. 50.000 criptos. Las conciencias de miles de personas están en juego.' },
    initialMessage: `La lluvia neon cae sobre los callejones de Neo-Shangai cuando recibes el mensaje. Tu cyberdeck vibra en tu bolsillo interior: un canal encriptado que no reconoces.

"Zero. Conocemos tu trabajo. Synapse Corp tiene algo que necesitamos. Proyecto Mnemotecnia. Recuerdos humanos extraídos y vendidos. Miles de víctimas conectadas sin su consentimiento. Necesitamos que entres, encuentres el servidor principal y liberes las conciencias. 50.000 criptos. La clienta anónima."

La transmisión se corta. Frente a ti, las luces de neón de la calle tiñen el asfalto mojado de azul y rosa. A dos cuadras, la torre corporativa de Synapse Corp se alza como un monolito oscuro contra el cielo contaminado, sus ventanas brillando con la frialdad de la tecnología.

Tu visor de realidad aumentada muestra las primeras capas de seguridad de la torre: cámaras, campos de fuerza, drones de patrulla. Infiltarás por las terminales de servicio en el nivel inferior. Es tu estilo.

{{Acceder a las terminales de servicio del nivel inferior}} {{Hackear el sistema de cámaras primero}} {{Contactar a tu informante en el barrio bajo}}`,
  },
  {
    id: 'arenas-tiempo',
    title: 'Las arenas del tiempo',
    subtitle: 'Exploración y sci-fi aventurero',
    description: 'Una anomalía temporal ha abierto portales aleatorios en el desierto de Atacama. Los viajeros que se adentran no regresan. Como piloto de reconocimiento de la Agencia Temporal, tu misión es explorar uno de estos portales, descubrir su origen y asegurar el área antes de que la línea temporal colapse.',
    difficulty: 'Fácil',
    estimatedTime: '30-45 min',
    icon: '⏳',
    setupAnswers: {
      ambientacion: 'Ciencia ficción',
      epoca: 'Futurista (2150)',
      ficha: 'Ficha detallada',
      clase: 'Piloto de exploración',
      personalidad: 'Aventurero y curioso',
      nombre: 'Orion',
      tipo_aventura: 'Exploración y descubrimiento',
      tono_narrador: 'Épica',
      modo_combate: 'Narrativo: el GM narra libremente',
    },
    combatMode: 'narrative',
    ttsEmotion: 'epico',
    adventureName: 'Las arenas del tiempo',
    character: {
      name: 'Orion',
      background: 'Orion Vega fue piloto de combate antes de unirse a la Agencia Temporal. Su instinto para detectar peligros y su capacidad para tomar decisiones bajo presión lo convierten en el candidato ideal para misiones de reconocimiento. Lleva tres años explorando anomalías y nunca ha perdido una misión.',
      traits: ['Aventurero', 'Curioso', 'Decidido', 'Optimista'],
      equipment: ['Traje de exploración temporal', 'Pistola de plasma', 'Escáner de anomalías', 'Módulo de comunicaciones', 'Raciones para 5 días', 'Kit de primeros auxilios', 'Cronómetro temporal'],
      stats: [
        { name: 'Destreza', value: 4 },
        { name: 'Constitución', value: 4 },
        { name: 'Inteligencia', value: 3 },
        { name: 'Sabiduría', value: 3 },
        { name: 'Fuerza', value: 3 },
        { name: 'Carisma', value: 2 },
      ],
      skills: [
        { name: 'Pilotaje', description: 'Domina naves espaciales y vehículos de exploración' },
        { name: 'Navegación temporal', description: 'Lectura de flujos cronológicos y estabilidad dimensional' },
        { name: 'Supervivencia', description: 'Sobrevive en entornos hostiles con recursos limitados' },
        { name: 'Combate espacial', description: 'Combate cuerpo a cuerpo con tecnología de plasma' },
      ],
      hp: 24,
      maxHp: 24,
    },
    quest: {
      title: 'La grieta en el desierto',
      description: 'Hace 72 horas, una anomalía temporal masiva apareció en el desierto de Atacama. La Agencia Temporal ha detectado firmas de energía que sugieren una conexión estable con otro período histórico. Tres equipos de reconocimiento han desaparecido. Eres el cuarto intento. Tu misión: entrar al portal, localizar a los equipos perdidos, descubrir el origen de la anomalía y asegurar la zona antes de que la línea temporal local colapse por completo.',
      objectives: [
        'Aterrizar en la zona de la anomalía y establecer base',
        'Entrar al portal temporal y explorar el período al que conecta',
        'Localizar a los equipos desaparecidos y descubrir qué causó la anomalía',
      ],
    },
    inventory: ['Escáner de anomalías', 'Módulo de comunicaciones', 'Raciones para 5 días', 'Cronómetro temporal'],
    initialJournalEntry: { title: 'Misión en Atacama', summary: 'La Agencia Temporal te ha encomendado explorar la anomalía del desierto. Tres equipos han desaparecido. La línea temporal local está inestable.' },
    initialMessage: `Tu nave de reconocimiento desciende sobre el desierto de Atacama. A través de la cabina, ves la anomalía: un remolino de luz dorada que flota a tres metros del suelo, pulsando como un corazón temporal. El aire a su alrededor se distorsiona, como si el tiempo mismo se doblara.

El escáner de anomalías grita datos: la firma temporal es estable pero creciente. La ventana de conexión podría durar horas... o minutos. No hay forma de saberlo.

Los restos del campamento del segundo equipo de reconocimiento están visibles a un kilómetro al norte. Tiendas despedazadas, equipamiento abandonado. Pero no hay cuerpos. Como si simplemente... hubieran dejado de existir.

Tu módulo de comunicaciones cruje: "Orion, la Agencia aquí. La estabilidad del portal está cambiando. Recomendamos entrada inmediata. Buena suerte."

El cronómetro temporal en tu muñeca marca las 14:32. La luz dorada del portal baila frente a ti, invitándote a cruzar.

{{Dirigirte al campamento abandonado para recoger pertrechos}} {{Entrar directamente al portal temporal}} {{Escanearear la zona con más detalle antes de entrar}}`,
  },
]