# Plan para Solicitar la Adición de Varios Artículos

Este plan describe cómo extender la funcionalidad actual de "Agregar Artículo" para que un usuario pueda elaborar una lista de artículos y enviar una única solicitud al administrador. El comportamiento será similar al apartado de "Sustraer Artículo", donde se permite seleccionar múltiples ítems antes de confirmar la solicitud.

## 1. Nuevo Componente
- Crear `AddMultipleItemsRequestComponent` en `src/components/inventory`.
- Basarse en `AddItemRequestComponent` para la validación de datos y en `SubtractItemsComponent` para la lógica de lista.
- El componente gestionará un formulario para añadir temporalmente cada artículo a una lista en memoria.

## 2. Estados y Estructuras
- Mantener un estado `itemsToRequest: Map<string, RequestedItem>` donde `RequestedItem` incluya nombre, subcategoría, cantidad y unidad.
- Después de rellenar el formulario, el botón "Añadir a la lista" agregará el artículo a `itemsToRequest` y limpiará el formulario.
- Mostrar la lista de artículos agregados con opción de eliminar elementos antes del envío definitivo.

## 3. Envío de Solicitud
- Incluir un botón "Enviar solicitud de adición" que abra un `AlertDialog` de confirmación.
- Al confirmar, enviar una única petición POST a `/api/inventory/request-addition`.
- Modificar el endpoint para aceptar `requestedItems: RequestedItem[]` (mantener compatibilidad admitiendo el formato antiguo `requestedItem`).
- Guardar en Firestore un documento en `additionRequests` con todos los artículos y datos de usuario (`userId`, `userName`, `requestTimestamp`, `status: 'pending'`).

## 4. Cambios en la Interfaz de Administrador
- Actualizar `AdditionRequest` en `src/app/admin/requests/page.tsx` para manejar un arreglo `requestedItems`.
- Adaptar la vista de cada solicitud para listar todos los artículos propuestos.
- Permitir al administrador aprobar o rechazar cada solicitud completa de manera similar a como se gestionan las solicitudes de sustracción.

## 5. Integración con InventoryApp
- Sustituir el uso de `AddItemRequestComponent` por el nuevo componente dentro de `InventoryApp`.
- Mantener las opciones de unidades y subcategorías predeterminadas como en el formulario actual.

## 6. Ajustes Adicionales
- Revisar las reglas de Firestore (archivo `firestore.rules`) para asegurar que los usuarios puedan crear documentos en `additionRequests` pero no modificarlos después.
- Añadir tests en `tests` para validar que la lista de artículos se construye correctamente y que la solicitud se envía con todos los datos requeridos.

Con estos pasos se permitirá al usuario preparar varias adiciones en una sola operación, agilizando el proceso y manteniendo un flujo de aprobación centralizado por parte del administrador.
