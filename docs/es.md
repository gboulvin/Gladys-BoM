# Bureau of Meteorology (BoM)

El tiempo australiano en Gladys, directamente del **Bureau of Meteorology**:
condiciones actuales de la estación de observación más cercana, pronósticos
por horas y a 7 días, avisos vigentes y nivel de peligro de incendio. Sin
cuenta ni clave de API. El BoM solo cubre **Australia**.

> Esta integración no está afiliada ni respaldada por el Bureau of
> Meteorology. Lee la API pública que usan la web y la aplicación del BoM;
> para los avisos oficiales, consulte siempre
> [bom.gov.au](https://www.bom.gov.au/) y los servicios de emergencia de su
> estado.

## Qué obtiene

- **El tiempo de Gladys**: la integración se convierte en el proveedor
  meteorológico de Gladys. El widget del tiempo del panel y el asistente
  («¿qué tiempo hará mañana?») usan los datos del BoM, en °C o °F según su
  perfil.
- **Alertas meteorológicas**: los avisos del BoM vigentes en su ubicación
  (tormenta severa, inundación, ola de calor, ciclón, viento marino…) y,
  opcionalmente, un peligro de incendio Alto, Extremo o Catastrófico, como
  alertas meteorológicas de Gladys.
- **Tres widgets**, **tres disparadores** y **tres acciones de escena**,
  descritos a continuación.

## Configuración

1. Instale la integración. La pantalla de instalación solicita acceso a la
   posición de sus casas: la integración la usa para saber qué lugar vigilar
   cuando no hay ninguna ubicación configurada.
2. Abra la pestaña **Configuración**:
   - **Ubicación**: un barrio, una ciudad, un código postal (`2150`) o
     `latitud,longitud`. Déjela vacía para usar la posición de su casa de
     Gladys (Ajustes → Casas). ¿Duda de la ortografía? Use el botón **Buscar
     un lugar**.
   - **Intervalo de comprobación de avisos**: frecuencia (de 5 a 60 minutos,
     10 por defecto) con la que se comprueban los avisos y el peligro de
     incendio que activan sus escenas.
   - **Peligro de incendio como alerta**: notifica los niveles Alto, Extremo
     y Catastrófico como alertas meteorológicas de Gladys.
3. Guarde y pulse **Probar la conexión**: se muestran el lugar encontrado y
   la última temperatura observada cerca.

## Widgets del panel

Añádalos desde el editor del panel. Cada widget tiene un ajuste opcional
**Ubicación** para mostrar otro lugar distinto del configurado.

- **Condiciones BoM**: temperatura observada, sensación térmica, humedad y
  viento, curva de temperatura de las próximas 24 horas, resumen del día,
  lluvia desde las 9h, peligro de incendio e índice UV máximo.
- **Pronóstico BoM 7 días**: una fila por día con mínima y máxima, resumen y
  probabilidad de lluvia; toque un día para ver el pronóstico detallado.
- **Avisos BoM**: los avisos vigentes, los mayores primero, cada uno con un
  enlace a su página del BoM, un botón **Actualizar** (nueva comprobación
  inmediata) y un enlace a todos los avisos de su estado.

## Escenas

En el editor de escenas, las tarjetas están en la categoría
**Integraciones**.

### Disparadores

- **Aviso del BoM emitido**: un nuevo aviso afecta a la ubicación. Filtros
  opcionales: tipo de aviso (inundación, tormenta severa, ola de calor, ciclón
  tropical…) y gravedad (mayor, menor). Vacíos, cualquier aviso coincide.
- **Fin de aviso del BoM**: un aviso fue cancelado o expiró. Mismos filtros.
- **Peligro de incendio cambiado**: el nivel de peligro de incendio de hoy
  cambió; opcionalmente filtre por el nuevo nivel (por ejemplo solo Extremo y
  Catastrófico).

Las acciones siguientes pueden leer los detalles:
`{{triggerEvent.data.title}}`, `{{triggerEvent.data.area}}`,
`{{triggerEvent.data.severity}}`, `{{triggerEvent.data.expiry_time}}`,
`{{triggerEvent.data.rating}}`…

La primera comprobación tras la instalación registra la situación sin
activar nada: los disparadores anuncian lo que cambia.

### Acciones

Cada acción tiene un campo opcional **Ubicación** (acepta variables de
escena); vacío, se usa la ubicación configurada. Los valores son métricos
(°C, km/h, mm).

- **Condiciones actuales BoM**: temperatura, sensación térmica, humedad,
  viento, ráfagas, lluvia desde las 9h, mínima y máxima hasta ahora, estación.
- **Pronóstico BoM**: para hoy o uno de los 6 días siguientes: mínima,
  máxima, resumen, texto detallado, probabilidad y cantidad de lluvia, UV,
  peligro de incendio, amanecer y atardecer.
- **Avisos BoM vigentes**: número de avisos vigentes (total, mayores,
  menores), si hay uno mayor vigente, y sus nombres.

## Bueno saber

- Los textos de pronóstico y los títulos de aviso del BoM están en inglés.
- Los datos se guardan en caché unos minutos (avisos 2 minutos,
  observaciones 5, pronósticos 15) para no sobrecargar los servidores del
  BoM.
- Fuera de Australia, la integración rechaza la solicitud y Gladys recurre a
  su otro proveedor meteorológico.

## Solución de problemas

- **«Sin ubicación»**: rellene el campo Ubicación o sitúe su casa en Gladys.
- **«Ningún lugar australiano coincide»**: pruebe con el código postal o use
  **Buscar un lugar**.
- **«Fuera de la zona cubierta»**: su casa no está en Australia; indique una
  Ubicación.
- Registros: Integraciones → Bureau of Meteorology (BoM) → Supervisión.
