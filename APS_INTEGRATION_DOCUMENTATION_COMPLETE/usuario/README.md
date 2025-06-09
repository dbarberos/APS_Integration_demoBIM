# Guía de Usuario - Plataforma de Integración APS

Esta guía proporciona instrucciones detalladas sobre cómo utilizar la Plataforma de Integración APS, desde la configuración inicial hasta el uso avanzado de todas sus funcionalidades.

## Índice de Contenidos

1. [Introducción](#introducción)
2. [Primeros Pasos](#primeros-pasos)
3. [Gestión de Proyectos](#gestión-de-proyectos)
4. [Gestión de Archivos](#gestión-de-archivos)
5. [Visualización de Modelos 3D](#visualización-de-modelos-3d)
6. [Herramientas de Colaboración](#herramientas-de-colaboración)
7. [Opciones de Configuración](#opciones-de-configuración)
8. [Preguntas Frecuentes](#preguntas-frecuentes)

## Introducción

La Plataforma de Integración APS es una aplicación web que facilita la gestión, visualización y colaboración en modelos CAD/BIM utilizando Autodesk Platform Services. La plataforma permite subir archivos CAD/BIM, traducirlos automáticamente a formatos optimizados y visualizarlos interactivamente en 3D.

### Características Principales

- **Gestión de Proyectos**: Organice sus modelos en proyectos
- **Upload de Archivos**: Soporte para múltiples formatos CAD/BIM
- **Traducción Automática**: Conversión a formatos optimizados para visualización
- **Visualizador 3D**: Explore y analice sus modelos con herramientas avanzadas
- **Colaboración**: Comparta y colabore en tiempo real
- **Gestión de Versiones**: Mantenga un historial de cambios

### Formatos Soportados

La plataforma soporta los siguientes formatos de archivo:

| Tipo | Formatos |
|------|----------|
| **Autodesk** | .rvt, .rfa, .dwg, .dxf, .dgn, .nwd, .dwf, .dwfx |
| **BIM** | .ifc |
| **CAD 3D** | .skp, .3dm, .stp, .step, .iges, .igs, .obj, .stl, .sat |
| **Otros** | .pdf, .fbx, .dae |

## Primeros Pasos

### Registro e Inicio de Sesión

1. **Registro de Usuario**:
   - Acceda a la página principal de la plataforma
   - Haga clic en "Registrarse"
   - Complete el formulario con su nombre, correo electrónico y contraseña
   - Confirme su correo electrónico a través del enlace enviado

2. **Inicio de Sesión**:
   - Acceda a la página principal
   - Ingrese su correo electrónico y contraseña
   - Haga clic en "Iniciar Sesión"

   ![Pantalla de Inicio de Sesión](../imgs/login-screen.png)

### Configuración de Cuenta

Después de iniciar sesión por primera vez, se recomienda completar su perfil y configurar sus preferencias:

1. Haga clic en su nombre de usuario en la esquina superior derecha
2. Seleccione "Perfil" o "Configuración"
3. Complete su información profesional
4. Configure sus preferencias de notificaciones
5. Guarde los cambios

### Tour de Bienvenida

La plataforma ofrece un tour interactivo que le guiará por las principales funcionalidades:

1. El tour se inicia automáticamente en su primer inicio de sesión
2. Puede acceder al tour en cualquier momento desde el menú de ayuda
3. Cada paso incluye una explicación breve y resaltado de la función

## Gestión de Proyectos

Los proyectos son la unidad principal de organización en la plataforma. Cada proyecto puede contener múltiples archivos y configuraciones específicas.

### Crear un Nuevo Proyecto

1. En el dashboard principal, haga clic en "Nuevo Proyecto"
2. Complete la información básica:
   - **Nombre**: Nombre descriptivo del proyecto
   - **Descripción**: Breve descripción del alcance y propósito
   - **Imagen de Portada** (opcional): Imagen representativa
3. Haga clic en "Crear Proyecto"

### Gestionar Proyectos Existentes

En la sección "Proyectos" puede:

- **Ver todos los proyectos**: Lista con vista en tarjetas o tabla
- **Buscar proyectos**: Utilizando la barra de búsqueda
- **Filtrar proyectos**: Por fecha, estado o etiquetas
- **Ordenar proyectos**: Por nombre, fecha o actividad reciente

### Editar un Proyecto

1. Acceda al proyecto deseado
2. Haga clic en el botón "Editar" (ícono de lápiz)
3. Modifique la información necesaria
4. Haga clic en "Guardar Cambios"

### Compartir un Proyecto

Para colaborar con otros usuarios:

1. Abra el proyecto que desea compartir
2. Haga clic en "Compartir"
3. Añada las direcciones de correo electrónico de los colaboradores
4. Seleccione el nivel de permisos:
   - **Visor**: Solo puede ver los modelos
   - **Colaborador**: Puede añadir comentarios y marcar áreas
   - **Editor**: Puede subir y modificar archivos
   - **Administrador**: Control total sobre el proyecto
5. Haga clic en "Invitar"

## Gestión de Archivos

### Subir Archivos

Existen múltiples formas de subir archivos al sistema:

1. **Método Drag & Drop**:
   - Acceda a un proyecto
   - Arrastre los archivos desde su explorador hasta la zona designada
   - Los archivos comenzarán a subirse automáticamente

2. **Selector de Archivos**:
   - Haga clic en el botón "Subir Archivo"
   - Seleccione los archivos desde el diálogo del sistema
   - Haga clic en "Abrir" para iniciar la subida

3. **Upload Avanzado** (para archivos grandes):
   - Haga clic en "Upload Avanzado"
   - Seleccione los archivos desde el diálogo
   - Configure opciones adicionales como chunks y prioridad
   - Inicie la subida

### Monitoreo de Progreso

Durante la subida y procesamiento de archivos:

1. Una barra de progreso muestra el avance de la subida
2. Después de la subida, comienza el proceso de traducción
3. El estado se actualiza en tiempo real:
   - **Subiendo**: Transferencia en curso
   - **Procesando**: Validación y preparación
   - **Traduciendo**: Conversión a formato de visualización
   - **Listo**: Archivo disponible para visualización
   - **Error**: Problema durante el proceso

![Progreso de Procesamiento](../imgs/file-processing.png)

### Organización de Archivos

Los archivos pueden organizarse de diversas formas:

- **Carpetas**: Cree carpetas para agrupar archivos relacionados
- **Etiquetas**: Asigne etiquetas para clasificación flexible
- **Filtros**: Filtre por tipo, fecha, estado o etiquetas
- **Ordenación**: Ordene por nombre, fecha, tamaño o tipo

### Versiones de Archivos

El sistema mantiene un control de versiones de los archivos:

1. Para subir una nueva versión:
   - Seleccione un archivo existente
   - Haga clic en "Subir Nueva Versión"
   - Seleccione el archivo actualizado
   - Añada comentarios sobre los cambios

2. Para gestionar versiones:
   - Acceda a la vista de detalles del archivo
   - Haga clic en la pestaña "Versiones"
   - Vea el historial completo de cambios
   - Compare versiones o restaure versiones anteriores

## Visualización de Modelos 3D

El visualizador 3D es una herramienta potente que permite explorar y analizar sus modelos de forma interactiva.

### Acceso al Visualizador

Para abrir un modelo en el visualizador:

1. Acceda a la lista de archivos del proyecto
2. Haga clic en el archivo que desea visualizar
3. Si el archivo está listo, se abrirá en el visualizador
4. Si aún está en procesamiento, se mostrará una notificación

### Navegación Básica

Controles principales de navegación:

- **Orbitar**: Clic izquierdo + arrastrar
- **Pan**: Clic derecho + arrastrar (o Shift + clic izquierdo + arrastrar)
- **Zoom**: Rueda del ratón (o Ctrl + clic izquierdo + arrastrar)
- **Home**: Botón de casa o tecla H para restablecer la vista

![Navegación del Visualizador](../imgs/viewer-navigation.png)

### Herramientas de Visualización

La barra de herramientas principal ofrece múltiples opciones:

- **Modos de Visualización**: Wireframe, sombreado, realista
- **Estilos Visuales**: Cambio de materiales y apariencia
- **Secciones**: Creación de planos de corte
- **Explosión**: Separación de componentes para ver interiores
- **Ocultar/Mostrar**: Control de visibilidad de elementos
- **Aislamiento**: Mostrar solo los elementos seleccionados

### Herramientas de Medición

Para realizar mediciones precisas:

1. Haga clic en la herramienta de medición en la barra de herramientas
2. Seleccione el tipo de medición:
   - **Distancia**: Entre dos puntos
   - **Ángulo**: Entre tres puntos o dos líneas
   - **Área**: De una superficie
3. Haga clic en los puntos relevantes del modelo
4. Las medidas se mostrarán en las unidades configuradas

### Árbol de Modelo

El panel lateral muestra la estructura jerárquica del modelo:

1. Explore la estructura expandiendo/colapsando nodos
2. Busque elementos específicos con la barra de búsqueda
3. Controle la visibilidad de elementos desde el árbol
4. Seleccione elementos para ver sus propiedades

### Panel de Propiedades

Al seleccionar un elemento del modelo:

1. El panel de propiedades muestra información detallada
2. Las propiedades se organizan por categorías
3. Puede buscar propiedades específicas
4. Los valores pueden copiarse al portapapeles

### Gestión de Múltiples Modelos

Para proyectos complejos con múltiples disciplinas:

1. Abra la pestaña "Modelos" en el panel lateral
2. Cargue modelos adicionales con "Añadir Modelo"
3. Controle la visibilidad y opacidad de cada modelo
4. Active la detección de interferencias entre modelos
5. Seleccione el modo de coordinación para asignar colores por disciplina

## Herramientas de Colaboración

### Comentarios y Marcas

Para añadir comentarios o marcar áreas del modelo:

1. Haga clic en la herramienta de markup en la barra de herramientas
2. Seleccione el tipo de marca:
   - **Texto**: Comentario simple
   - **Flecha**: Señalar un elemento específico
   - **Rectángulo**: Resaltar un área
   - **Círculo**: Resaltar un punto de interés
   - **Nube**: Marcar una zona con problema
3. Dibuje la marca en la vista 3D
4. Añada un comentario descriptivo
5. Guarde la marca

### Compartir Vistas

Para compartir una vista específica del modelo:

1. Configure la vista deseada (posición, zoom, elementos visibles)
2. Haga clic en "Compartir Vista" en el menú superior
3. Añada un título y descripción
4. Copie el enlace generado o envíelo directamente por correo
5. Los destinatarios podrán abrir exactamente la misma vista

### Colaboración en Tiempo Real

Si múltiples usuarios están visualizando el mismo modelo simultáneamente:

1. Verá indicadores con los nombres de los usuarios activos
2. Puede ver los cursores de otros usuarios en tiempo real
3. Los comentarios nuevos se notifican instantáneamente
4. Puede seguir la vista de otro usuario haciendo clic en su nombre

## Opciones de Configuración

### Configuración del Visualizador

Personalice su experiencia de visualización:

1. Acceda a "Configuración" desde el menú del visualizador
2. Ajuste las siguientes opciones:
   - **Rendimiento**: Calidad gráfica y rendimiento
   - **Unidades**: Métricas o imperiales
   - **Tema**: Claro, oscuro o personalizado
   - **Atajos de Teclado**: Personalización de atajos
   - **Extensiones**: Activar/desactivar funcionalidades

### Notificaciones

Configure sus preferencias de notificación:

1. Acceda a "Configuración" desde el menú principal
2. Seleccione la pestaña "Notificaciones"
3. Configure las notificaciones por tipo:
   - **Subidas Completadas**: Cuando se completa una subida
   - **Traducciones**: Estado de los procesos de traducción
   - **Comentarios**: Nuevos comentarios en sus modelos
   - **Compartido**: Cuando se comparte un proyecto con usted
4. Elija los canales de notificación (email, plataforma, desktop)

### Perfil de Usuario

Personalice su perfil y preferencias:

1. Haga clic en su avatar en la esquina superior derecha
2. Seleccione "Perfil"
3. Actualice su información personal y profesional
4. Cambie su contraseña o configure autenticación de dos factores
5. Vincule sus cuentas de Autodesk u otros servicios

## Preguntas Frecuentes

### Subida de Archivos

**P: ¿Qué tamaño máximo de archivo puedo subir?**  
R: El límite estándar es de 5GB por archivo. Para archivos más grandes, contacte al administrador.

**P: ¿Por qué mi archivo está tardando tanto en procesarse?**  
R: El tiempo de procesamiento depende del tamaño y complejidad del modelo. Los archivos Revit y archivos grandes pueden tardar más tiempo.

**P: ¿Puedo cancelar una subida en progreso?**  
R: Sí, haga clic en el botón "Cancelar" junto a la barra de progreso.

### Visualización

**P: ¿Por qué no puedo ver texturas o materiales?**  
R: Verifique que la opción "Materiales" esté activada en el menú de estilos visuales. Algunos formatos pueden no soportar texturas.

**P: El modelo se ve muy lento, ¿cómo puedo mejorar el rendimiento?**  
R: Acceda a "Configuración > Rendimiento" y reduzca la calidad gráfica, o active el modo "Performance".

**P: ¿Cómo puedo guardar una vista específica?**  
R: Use la función "Guardar Vista" en el menú superior. Las vistas guardadas aparecerán en la pestaña "Vistas".

### Colaboración

**P: ¿Cómo puedo saber quién ha hecho cambios en un archivo?**  
R: Acceda a la pestaña "Historial" en los detalles del archivo para ver un registro completo de actividad.

**P: ¿Puedo revocar el acceso a un proyecto compartido?**  
R: Sí, acceda a la configuración del proyecto, seleccione "Compartido con" y elimine los usuarios o modifique sus permisos.

### Otros

**P: ¿Cómo puedo exportar medidas o propiedades?**  
R: Use el botón "Exportar" en el panel de propiedades o de medidas para generar un archivo CSV o PDF.

**P: ¿Puedo acceder a la plataforma desde dispositivos móviles?**  
R: Sí, la plataforma es responsive y funciona en tablets y smartphones, aunque algunas funcionalidades avanzadas pueden requerir un dispositivo de escritorio.

## Recursos Adicionales

- [Video Tutoriales](./tutoriales-video.md)
- [Guía de Atajos de Teclado](./atajos-teclado.md)
- [Casos de Uso Avanzados](./casos-uso-avanzados.md)
- [Glosario de Términos](./glosario.md)