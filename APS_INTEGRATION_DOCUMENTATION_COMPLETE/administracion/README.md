# Guía de Administración - Plataforma de Integración APS

Esta guía proporciona información detallada para administradores de la Plataforma de Integración APS, incluyendo configuración, mantenimiento, monitoreo y gestión de usuarios.

## Índice de Contenidos

1. [Introducción](#introducción)
2. [Panel de Administración](#panel-de-administración)
3. [Gestión de Usuarios](#gestión-de-usuarios)
4. [Configuración del Sistema](#configuración-del-sistema)
5. [Monitoreo y Diagnóstico](#monitoreo-y-diagnóstico)
6. [Mantenimiento del Sistema](#mantenimiento-del-sistema)
7. [Respaldo y Recuperación](#respaldo-y-recuperación)
8. [Integración con Autodesk](#integración-con-autodesk)
9. [Seguridad](#seguridad)
10. [Resolución de Problemas](#resolución-de-problemas)

## Introducción

Esta sección está destinada a administradores del sistema, proporcionando herramientas y conocimientos para la gestión efectiva de la Plataforma de Integración APS. El rol de administrador incluye configuración, mantenimiento, monitoreo y resolución de problemas del sistema.

### Acceso a Funciones de Administración

Para acceder a las funciones administrativas:

1. Inicie sesión con una cuenta que tenga permisos de administrador
2. Haga clic en su nombre de usuario en la esquina superior derecha
3. Seleccione "Administración" del menú desplegable

El sistema proporciona diferentes niveles de permisos administrativos:

- **Super Admin**: Acceso completo a todas las funciones del sistema
- **Admin**: Gestión de usuarios y proyectos, configuración limitada
- **Admin de Proyecto**: Control sobre proyectos específicos
- **Gestor de Usuarios**: Solo gestión de usuarios y permisos

## Panel de Administración

El Panel de Administración proporciona una visión general del estado del sistema y acceso a todas las funciones administrativas.

### Vista General

La página principal del panel muestra:

- **Estadísticas de Uso**: Usuarios activos, proyectos, archivos
- **Gráficos de Actividad**: Tendencias de uso en el tiempo
- **Estado del Sistema**: Servicios activos, performance, almacenamiento
- **Alertas**: Problemas actuales o notificaciones importantes
- **Actividad Reciente**: Últimas acciones administrativas

![Panel de Administración](../imgs/admin-dashboard.png)

### Navegación

El menú lateral proporciona acceso a todas las secciones administrativas:

- **Dashboard**: Visión general del sistema
- **Usuarios**: Gestión de cuentas y permisos
- **Proyectos**: Administración de proyectos
- **Archivos**: Gestión y monitoreo de archivos
- **Traducciones**: Estado de los trabajos de traducción
- **Configuración**: Ajustes del sistema
- **Logs**: Registros y auditoría
- **Monitoreo**: Métricas de rendimiento
- **Herramientas**: Utilidades administrativas

## Gestión de Usuarios

### Listado y Búsqueda de Usuarios

La sección "Usuarios" proporciona una lista completa de usuarios:

1. Vea todos los usuarios en una tabla con información clave
2. Busque usuarios por nombre, email o ID
3. Filtre por estado, rol, fecha de creación o último acceso
4. Ordene por cualquier columna haciendo clic en el encabezado

### Creación de Usuarios

Para crear nuevos usuarios:

1. Haga clic en el botón "Añadir Usuario"
2. Complete la información requerida:
   - Nombre completo
   - Dirección de correo electrónico
   - Contraseña inicial (o generar automáticamente)
   - Rol del sistema
3. Configure opciones adicionales:
   - Fecha de expiración (opcional)
   - Requiere cambio de contraseña en primer login
   - Enviar email de bienvenida
4. Haga clic en "Crear Usuario"

### Edición de Usuarios

Para modificar usuarios existentes:

1. Busque y seleccione el usuario deseado
2. Haga clic en "Editar"
3. Modifique la información necesaria
4. Guarde los cambios

### Gestión de Roles y Permisos

El sistema utiliza un modelo basado en roles (RBAC):

1. **Roles Predefinidos**:
   - **Administrador**: Control total del sistema
   - **Gestor**: Puede crear y gestionar proyectos
   - **Editor**: Puede editar contenido en proyectos asignados
   - **Visor**: Solo acceso de lectura

2. **Permisos Personalizados**:
   Para roles más específicos:
   - Haga clic en "Roles" en la sección de Usuarios
   - Seleccione "Crear Rol Personalizado"
   - Asigne permisos específicos por categoría
   - Asigne el nuevo rol a los usuarios

### Bloqueo y Desbloqueo de Cuentas

Para gestionar el acceso de usuarios:

1. Seleccione el usuario deseado
2. Haga clic en "Bloquear Cuenta" o "Desbloquear Cuenta"
3. Confirme la acción
4. Opcionalmente, añada una nota explicativa

Las cuentas también pueden bloquearse automáticamente por:
- Múltiples intentos fallidos de inicio de sesión
- Inactividad prolongada
- Violaciones de políticas de seguridad

### Auditoría de Actividad de Usuario

Para revisar la actividad de los usuarios:

1. Seleccione un usuario
2. Haga clic en la pestaña "Actividad"
3. Vea un registro cronológico de acciones
4. Filtre por tipo de acción, fecha o proyecto
5. Exporte los registros a CSV para análisis

## Configuración del Sistema

### Ajustes Generales

La página "Configuración General" permite ajustar:

- **Nombre de la Aplicación**: Personalización del título
- **Logo y Marca**: Personalización de la identidad visual
- **Zona Horaria**: Configuración de la zona horaria predeterminada
- **Idioma**: Idioma predeterminado del sistema
- **URL Base**: URL principal de la aplicación

### Almacenamiento

Configure opciones de almacenamiento:

- **Límites de Tamaño**: Tamaño máximo de archivo permitido
- **Cuotas de Usuario**: Espacio de almacenamiento por usuario
- **Retención**: Políticas de retención de archivos
- **Purga Automática**: Configuración de limpieza automática

### Traducciones

Configuración del sistema de traducción APS:

- **Formatos de Salida**: SVF, SVF2, OBJ, etc.
- **Calidad**: Presets de calidad de traducción
- **Opciones Avanzadas**: Parámetros específicos por tipo de archivo
- **Timeouts**: Configuración de tiempos máximos
- **Reintentos**: Políticas de reintento automático

### Notificaciones

Configure el sistema de notificaciones:

- **Email**: Configuración SMTP para notificaciones por correo
- **Webhooks**: Endpoints para integraciones externas
- **Plantillas**: Personalización de mensajes de notificación
- **Programación**: Configuración de digests y resúmenes

### Seguridad

Ajustes de seguridad del sistema:

- **Política de Contraseñas**: Requisitos de complejidad
- **Sesiones**: Duración y gestión de sesiones
- **2FA**: Configuración de autenticación de dos factores
- **IP Allowlist**: Restricciones de acceso por IP
- **CORS**: Configuración de dominios permitidos

### Integración de APS

Configuración de la integración con Autodesk Platform Services:

- **Credenciales**: Client ID y Client Secret
- **Scopes**: Permisos solicitados
- **Callback URLs**: URLs de retorno para OAuth
- **Webhooks**: Configuración de webhooks APS

## Monitoreo y Diagnóstico

### Dashboard de Monitoreo

El dashboard de monitoreo proporciona una visión en tiempo real:

- **Utilización de CPU/Memoria**: Gráficos de uso de recursos
- **Respuesta de API**: Tiempos de respuesta y throughput
- **Trabajos de Traducción**: Estado y métricas
- **Sesiones Activas**: Usuarios conectados
- **Almacenamiento**: Uso y disponibilidad

![Dashboard de Monitoreo](../imgs/monitoring-dashboard.png)

### Alertas y Notificaciones

Configure alertas para condiciones críticas:

1. Acceda a "Monitoreo > Alertas"
2. Haga clic en "Nueva Alerta"
3. Configure los parámetros:
   - **Métrica**: CPU, memoria, errores, etc.
   - **Umbral**: Valor que dispara la alerta
   - **Duración**: Tiempo que debe mantenerse la condición
   - **Severidad**: Info, Warning, Error, Critical
   - **Notificación**: Canales de notificación

### Logs del Sistema

Para acceder a los registros detallados:

1. Vaya a "Administración > Logs"
2. Seleccione el tipo de log:
   - **Application**: Logs generales de la aplicación
   - **Access**: Registros de acceso y autenticación
   - **Error**: Errores y excepciones
   - **Audit**: Acciones administrativas
   - **Integration**: Logs de APS y sistemas externos
3. Filtre por fecha, nivel, servicio o texto
4. Exporte logs para análisis detallado

### Métricas de Rendimiento

Monitoreo detallado de métricas:

- **API**: Latencia, throughput, tasa de error
- **Database**: Queries, conexiones, tiempos de respuesta
- **Traducciones**: Tiempo promedio, tasa de éxito
- **Upload/Download**: Velocidad y volumen
- **WebSocket**: Conexiones, mensajes, latencia

### Health Checks

Verificación del estado de componentes:

1. Acceda a "Monitoreo > Health Checks"
2. Vea el estado actual de todos los servicios:
   - **API Backend**: Estado del servicio FastAPI
   - **Database**: Conectividad y performance
   - **Redis**: Estado del cache
   - **APS Services**: Conectividad con Autodesk
   - **Storage**: Acceso a almacenamiento
   - **Workers**: Estado de trabajadores Celery

## Mantenimiento del Sistema

### Actualizaciones de Software

Para actualizar la plataforma:

1. Revise las notas de versión para la nueva versión
2. Realice un respaldo completo del sistema
3. Notifique a los usuarios sobre ventana de mantenimiento
4. Use el script de actualización:
   ```bash
   ./scripts/update.sh --version X.Y.Z
   ```
5. Verifique la integridad después de la actualización

### Mantenimiento de Base de Datos

Tareas periódicas de mantenimiento:

- **Vacuum**: Optimización y recuperación de espacio
  ```bash
  ./scripts/db-maintenance.sh --vacuum
  ```
- **Reindex**: Reconstrucción de índices
  ```bash
  ./scripts/db-maintenance.sh --reindex
  ```
- **Analyze**: Actualización de estadísticas
  ```bash
  ./scripts/db-maintenance.sh --analyze
  ```

### Limpieza de Archivos Temporales

Para liberar espacio de almacenamiento:

1. Acceda a "Herramientas > Limpieza"
2. Seleccione las categorías de archivos a limpiar:
   - **Archivos Temporales**: Uploads incompletos
   - **Traducciones Fallidas**: Trabajos de traducción fallidos
   - **Caches**: Archivos de caché antiguos
3. Establezca un umbral de antigüedad
4. Ejecute la limpieza

### Rotación de Logs

Gestión de archivos de log:

- La rotación automática está configurada por defecto
- Para forzar una rotación:
  ```bash
  ./scripts/rotate-logs.sh
  ```
- Configure retención en "Configuración > Logs"

## Respaldo y Recuperación

### Estrategia de Respaldo

El sistema implementa una estrategia de respaldo en capas:

- **Respaldo Diario**: Respaldo incremental diario
- **Respaldo Semanal**: Respaldo completo semanal
- **Respaldo Mensual**: Respaldo completo mensual archivado
- **Respaldo Pre-actualización**: Automático antes de actualizaciones

### Respaldo Manual

Para realizar un respaldo manual:

1. Acceda a "Herramientas > Respaldo"
2. Seleccione el tipo de respaldo:
   - **Completo**: Base de datos y archivos
   - **Solo Base de Datos**: Datos estructurados
   - **Solo Archivos**: Contenido de usuario
3. Especifique la ubicación del respaldo
4. Inicie el proceso

También puede usar el script de línea de comandos:
```bash
./scripts/backup-restore.sh --backup --type full --output /path/to/backup
```

### Restauración

Para restaurar desde un respaldo:

1. Acceda a "Herramientas > Restauración"
2. Seleccione el archivo de respaldo
3. Elija el modo de restauración:
   - **Completa**: Reemplaza todos los datos actuales
   - **Selectiva**: Restaura solo elementos específicos
4. Confirme e inicie la restauración

Desde la línea de comandos:
```bash
./scripts/backup-restore.sh --restore --input /path/to/backup
```

### Recuperación de Desastres

En caso de fallo catastrófico:

1. Despliegue una nueva instancia del sistema
2. Restaure la última copia de seguridad completa
3. Aplique respaldos incrementales posteriores
4. Verifique la integridad y actualice configuraciones específicas
5. Realice pruebas antes de poner en producción

## Integración con Autodesk

### Gestión de Credenciales APS

Para actualizar o rotar credenciales:

1. Acceda a "Configuración > Integraciones > APS"
2. Actualice Client ID y Client Secret
3. Verifique los scopes necesarios
4. Actualice URLs de callback si es necesario
5. Guarde y pruebe la integración

### Monitoreo de Cuotas APS

Supervise el uso de recursos APS:

1. Acceda a "Monitoreo > APS"
2. Vea métricas de uso actual:
   - **API Calls**: Llamadas por día/hora
   - **Storage**: Uso de almacenamiento OSS
   - **Translations**: Trabajos de traducción
3. Configure alertas para umbrales de uso

### Gestión de Webhooks

Configure notificaciones de APS:

1. Acceda a "Configuración > Webhooks"
2. Configure endpoints para eventos:
   - **Translation.Complete**: Traducción completada
   - **Translation.Failed**: Error en traducción
   - **OSS.ObjectCreated**: Archivo creado
   - **OSS.ObjectRemoved**: Archivo eliminado
3. Pruebe cada webhook con la función "Enviar Prueba"

## Seguridad

### Auditoría de Seguridad

Herramientas para análisis de seguridad:

1. Acceda a "Seguridad > Auditoría"
2. Ejecute verificaciones predefinidas:
   - **Permisos**: Revisión de permisos y roles
   - **Autenticación**: Análisis de intentos fallidos
   - **API**: Uso sospechoso de API
   - **Archivos**: Detección de archivos maliciosos
3. Genere informe detallado

### Gestión de Sesiones

Monitoreo y gestión de sesiones activas:

1. Acceda a "Seguridad > Sesiones"
2. Vea todas las sesiones activas con:
   - Usuario
   - Dirección IP
   - Tiempo de inicio
   - Último acceso
   - Dispositivo/Navegador
3. Termine sesiones sospechosas o inactivas

### Control de Acceso

Gestión granular de permisos:

1. Acceda a "Seguridad > Control de Acceso"
2. Configure restricciones por:
   - **IP**: Restricción por dirección o rango
   - **Hora**: Limitación por horario
   - **Ubicación**: Restricción geográfica
   - **Dispositivo**: Limitación por tipo de dispositivo

### Registro de Seguridad

Análisis de eventos de seguridad:

1. Acceda a "Seguridad > Eventos"
2. Revise eventos como:
   - Inicios de sesión fallidos
   - Cambios de permisos
   - Accesos a recursos sensibles
   - Cambios de configuración
3. Configure alertas para patrones sospechosos

## Resolución de Problemas

### Problemas Comunes y Soluciones

#### Error en Traducción de Modelos

**Síntoma**: Los trabajos de traducción fallan con error "Translation Failed"

**Soluciones**:
1. Verifique credenciales APS en "Configuración > Integraciones"
2. Compruebe cuotas APS en el portal de desarrollador
3. Examine el archivo original por corrupción
4. Verifique logs detallados en "Logs > Integration"
5. Intente una traducción con configuración básica

#### Performance Lenta del Sistema

**Síntoma**: Tiempos de respuesta elevados, carga lenta

**Soluciones**:
1. Verifique uso de recursos en "Monitoreo > Recursos"
2. Compruebe conexiones a base de datos en "Monitoreo > Database"
3. Revise tendencias de carga en "Monitoreo > Actividad"
4. Ejecute herramienta de diagnóstico:
   ```bash
   ./scripts/diagnose-performance.sh
   ```
5. Considere escalar recursos si es persistente

#### Problemas de Almacenamiento

**Síntoma**: Errores al subir o acceder a archivos

**Soluciones**:
1. Verifique espacio disponible en "Monitoreo > Almacenamiento"
2. Compruebe permisos del sistema de archivos
3. Revise conexión con servicios de almacenamiento
4. Ejecute verificación de integridad:
   ```bash
   ./scripts/check-storage.sh
   ```

### Herramientas de Diagnóstico

Para análisis completo del sistema:

1. Acceda a "Herramientas > Diagnóstico"
2. Ejecute la herramienta de diagnóstico completo
3. Revise el informe detallado
4. Siga las recomendaciones proporcionadas

### Soporte y Asistencia

Para problemas que requieran asistencia externa:

1. Genere un informe de soporte:
   ```bash
   ./scripts/generate-support-report.sh
   ```
2. Contacte al soporte técnico con el informe
3. Proporcione acceso temporal de diagnóstico si se solicita

## Recursos Adicionales

- [Referencia de Línea de Comandos](./cli-reference.md)
- [Guía de Migración entre Versiones](./migracion-versiones.md)
- [Mejores Prácticas de Seguridad](./seguridad-best-practices.md)
- [Ejemplos de Configuración Avanzada](./configuracion-avanzada.md)