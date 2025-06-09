// Extensión personalizada para colaboración en tiempo real
export class CollaborationExtension extends window.Autodesk.Viewing.Extension {
  private socket: WebSocket | null = null
  private sessionId: string
  private userId: string
  private isConnected = false
  private collaborators: Map<string, any> = new Map()
  private cursors: Map<string, THREE.Object3D> = new Map()
  private annotations: Map<string, any> = new Map()
  private onCollaboratorJoined?: (collaborator: any) => void
  private onCollaboratorLeft?: (collaboratorId: string) => void
  private onAnnotationCreated?: (annotation: any) => void
  private onCursorUpdated?: (cursor: any) => void

  constructor(viewer: any, options: any) {
    super(viewer, options)
    this.name = 'CollaborationExtension'
    this.sessionId = options.sessionId || this.generateSessionId()
    this.userId = options.userId || this.generateUserId()
    this.onCollaboratorJoined = options.onCollaboratorJoined
    this.onCollaboratorLeft = options.onCollaboratorLeft
    this.onAnnotationCreated = options.onAnnotationCreated
    this.onCursorUpdated = options.onCursorUpdated
  }

  load() {
    console.log('CollaborationExtension loaded')
    this.setupEventListeners()
    this.connectToCollaborationServer()
    return true
  }

  unload() {
    this.disconnect()
    this.clearAllCollaborationElements()
    console.log('CollaborationExtension unloaded')
    return true
  }

  // Configurar event listeners del viewer
  private setupEventListeners() {
    this.viewer.addEventListener(window.Autodesk.Viewing.CAMERA_CHANGE_EVENT, this.onCameraChange.bind(this))
    this.viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, this.onSelectionChange.bind(this))
    
    // Event listener para movimiento del mouse
    this.viewer.container.addEventListener('mousemove', this.onMouseMove.bind(this))
    this.viewer.container.addEventListener('click', this.onMouseClick.bind(this))
  }

  // Conectar al servidor de colaboración
  private connectToCollaborationServer() {
    try {
      // En un entorno real, esto sería una URL de WebSocket válida
      const wsUrl = `wss://collaboration-server.example.com/session/${this.sessionId}`
      
      // Simular conexión WebSocket (para demo)
      this.simulateWebSocketConnection()
      
    } catch (error) {
      console.error('Error connecting to collaboration server:', error)
    }
  }

  // Simular conexión WebSocket para propósitos de demostración
  private simulateWebSocketConnection() {
    this.isConnected = true
    console.log(`Connected to collaboration session: ${this.sessionId}`)
    
    // Simular eventos de colaboración
    setTimeout(() => {
      this.simulateCollaboratorJoin({
        id: 'user_demo_1',
        name: 'Usuario Demo 1',
        avatar: 'https://via.placeholder.com/32',
        color: '#ff6b6b'
      })
    }, 2000)
    
    setTimeout(() => {
      this.simulateCollaboratorJoin({
        id: 'user_demo_2',
        name: 'Usuario Demo 2',
        avatar: 'https://via.placeholder.com/32',
        color: '#4ecdc4'
      })
    }, 4000)
  }

  // Simular entrada de colaborador
  private simulateCollaboratorJoin(collaborator: any) {
    this.collaborators.set(collaborator.id, collaborator)
    this.createCollaboratorCursor(collaborator)
    this.onCollaboratorJoined?.(collaborator)
  }

  // Crear cursor de colaborador
  private createCollaboratorCursor(collaborator: any) {
    const cursorGeometry = new THREE.ConeGeometry(0.1, 0.3, 8)
    const cursorMaterial = new THREE.MeshBasicMaterial({ 
      color: collaborator.color,
      transparent: true,
      opacity: 0.8
    })
    
    const cursor = new THREE.Mesh(cursorGeometry, cursorMaterial)
    cursor.name = `cursor_${collaborator.id}`
    
    // Agregar etiqueta con nombre
    const labelCanvas = document.createElement('canvas')
    const context = labelCanvas.getContext('2d')!
    labelCanvas.width = 128
    labelCanvas.height = 32
    
    context.fillStyle = collaborator.color
    context.fillRect(0, 0, labelCanvas.width, labelCanvas.height)
    
    context.fillStyle = 'white'
    context.font = '14px Arial'
    context.textAlign = 'center'
    context.fillText(collaborator.name, labelCanvas.width / 2, labelCanvas.height / 2 + 5)
    
    const labelTexture = new THREE.CanvasTexture(labelCanvas)
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture })
    const labelSprite = new THREE.Sprite(labelMaterial)
    labelSprite.scale.set(1, 0.25, 1)
    labelSprite.position.set(0, 0.5, 0)
    
    cursor.add(labelSprite)
    
    // Agregar al overlay
    this.viewer.impl.createOverlayScene('collaboration-cursors')
    this.viewer.impl.addOverlay('collaboration-cursors', cursor)
    
    this.cursors.set(collaborator.id, cursor)
    
    // Simular movimiento del cursor
    this.simulateCursorMovement(collaborator.id)
  }

  // Simular movimiento de cursor
  private simulateCursorMovement(collaboratorId: string) {
    const cursor = this.cursors.get(collaboratorId)
    if (!cursor) return
    
    const animate = () => {
      if (this.cursors.has(collaboratorId)) {
        // Movimiento aleatorio suave
        const time = Date.now() * 0.001
        const radius = 5
        
        cursor.position.x = Math.sin(time + collaboratorId.length) * radius
        cursor.position.y = Math.cos(time * 0.7 + collaboratorId.length) * radius * 0.5
        cursor.position.z = Math.sin(time * 0.3 + collaboratorId.length) * radius * 0.3
        
        this.viewer.impl.invalidate(true)
        
        setTimeout(animate, 100) // 10 FPS para cursores
      }
    }
    
    animate()
  }

  // Manejadores de eventos del viewer
  private onCameraChange(event: any) {
    if (!this.isConnected) return
    
    const camera = this.viewer.getCamera()
    const cameraData = {
      position: camera.position,
      target: camera.target,
      up: camera.up,
      fov: camera.fov,
      timestamp: Date.now()
    }
    
    this.broadcastEvent('camera_change', cameraData)
  }

  private onSelectionChange(event: any) {
    if (!this.isConnected) return
    
    const selection = this.viewer.getSelection()
    const selectionData = {
      objectIds: selection,
      userId: this.userId,
      timestamp: Date.now()
    }
    
    this.broadcastEvent('selection_change', selectionData)
    this.visualizeCollaboratorSelection(selectionData)
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.isConnected) return
    
    // Throttle mouse events
    if (Date.now() - (this.lastMouseMoveTime || 0) < 50) return
    this.lastMouseMoveTime = Date.now()
    
    const rect = this.viewer.container.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    const cursorData = {
      x: x,
      y: y,
      userId: this.userId,
      timestamp: Date.now()
    }
    
    this.broadcastEvent('cursor_move', cursorData)
  }

  private onMouseClick(event: MouseEvent) {
    if (!this.isConnected || event.shiftKey) return // Shift+click para anotar
    
    const rect = this.viewer.container.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    const hitResult = this.viewer.impl.hitTest(x, y, false)
    if (hitResult) {
      this.createAnnotation(hitResult.intersectPoint, event.shiftKey)
    }
  }

  private lastMouseMoveTime = 0

  // Transmitir evento a otros colaboradores
  private broadcastEvent(eventType: string, data: any) {
    const message = {
      type: eventType,
      data: data,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: Date.now()
    }
    
    // En un entorno real, esto enviaría via WebSocket
    console.log('Broadcasting event:', message)
  }

  // Crear anotación colaborativa
  private createAnnotation(position: THREE.Vector3, isComment: boolean = false) {
    const annotationId = this.generateAnnotationId()
    
    const annotation = {
      id: annotationId,
      position: position,
      type: isComment ? 'comment' : 'marker',
      userId: this.userId,
      userName: 'Usuario Actual',
      content: isComment ? 'Nueva anotación' : '',
      created: new Date(),
      visible: true,
      resolved: false
    }
    
    this.annotations.set(annotationId, annotation)
    this.visualizeAnnotation(annotation)
    this.onAnnotationCreated?.(annotation)
    
    // Transmitir a otros colaboradores
    this.broadcastEvent('annotation_created', annotation)
    
    return annotation
  }

  // Visualizar anotación
  private visualizeAnnotation(annotation: any) {
    const overlayName = 'collaboration-annotations'
    
    if (!this.viewer.impl.overlayScenes[overlayName]) {
      this.viewer.impl.createOverlayScene(overlayName)
    }
    
    // Crear marcador de anotación
    const geometry = new THREE.SphereGeometry(0.2, 16, 16)
    const material = new THREE.MeshBasicMaterial({
      color: annotation.type === 'comment' ? 0x2196f3 : 0xff9800,
      transparent: true,
      opacity: 0.8
    })
    
    const marker = new THREE.Mesh(geometry, material)
    marker.position.copy(annotation.position)
    marker.name = `annotation_${annotation.id}`
    
    // Agregar pulsación
    const animate = () => {
      const scale = 1 + Math.sin(Date.now() * 0.005) * 0.2
      marker.scale.setScalar(scale)
      
      if (this.annotations.has(annotation.id)) {
        requestAnimationFrame(animate)
      }
    }
    animate()
    
    // Crear número de anotación
    const annotationNumber = Array.from(this.annotations.keys()).indexOf(annotation.id) + 1
    const numberCanvas = document.createElement('canvas')
    const context = numberCanvas.getContext('2d')!
    numberCanvas.width = 64
    numberCanvas.height = 64
    
    context.fillStyle = annotation.type === 'comment' ? '#2196f3' : '#ff9800'
    context.beginPath()
    context.arc(32, 32, 30, 0, Math.PI * 2)
    context.fill()
    
    context.fillStyle = 'white'
    context.font = 'bold 24px Arial'
    context.textAlign = 'center'
    context.fillText(annotationNumber.toString(), 32, 40)
    
    const numberTexture = new THREE.CanvasTexture(numberCanvas)
    const numberMaterial = new THREE.SpriteMaterial({ map: numberTexture })
    const numberSprite = new THREE.Sprite(numberMaterial)
    numberSprite.position.set(0, 0.5, 0)
    numberSprite.scale.set(0.5, 0.5, 1)
    
    marker.add(numberSprite)
    
    this.viewer.impl.addOverlay(overlayName, marker)
    
    // Agregar evento de clic
    marker.userData = { annotation: annotation }
  }

  // Visualizar selección de colaborador
  private visualizeCollaboratorSelection(selectionData: any) {
    if (selectionData.userId === this.userId) return // No mostrar propia selección
    
    const collaborator = this.collaborators.get(selectionData.userId)
    if (!collaborator) return
    
    // Resaltar objetos seleccionados por el colaborador
    selectionData.objectIds.forEach((objectId: number) => {
      this.viewer.setThemingColor(objectId, new THREE.Vector4(
        parseInt(collaborator.color.substr(1, 2), 16) / 255,
        parseInt(collaborator.color.substr(3, 2), 16) / 255,
        parseInt(collaborator.color.substr(5, 2), 16) / 255,
        0.5
      ))
    })
    
    // Limpiar después de un tiempo
    setTimeout(() => {
      selectionData.objectIds.forEach((objectId: number) => {
        this.viewer.clearThemingColors()
      })
    }, 3000)
  }

  // Funciones de utilidad
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateAnnotationId(): string {
    return `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Desconectar de la sesión de colaboración
  private disconnect() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.isConnected = false
  }

  // Limpiar elementos de colaboración
  private clearAllCollaborationElements() {
    ['collaboration-cursors', 'collaboration-annotations'].forEach(overlayName => {
      if (this.viewer.impl.overlayScenes[overlayName]) {
        this.viewer.impl.clearOverlay(overlayName)
      }
    })
    
    this.collaborators.clear()
    this.cursors.clear()
    this.annotations.clear()
  }

  // API pública
  getCollaborators(): any[] {
    return Array.from(this.collaborators.values())
  }

  getAnnotations(): any[] {
    return Array.from(this.annotations.values())
  }

  deleteAnnotation(annotationId: string): boolean {
    const annotation = this.annotations.get(annotationId)
    if (!annotation) return false
    
    // Remover visualización
    const overlayName = 'collaboration-annotations'
    this.viewer.impl.removeOverlay(overlayName, `annotation_${annotationId}`)
    
    this.annotations.delete(annotationId)
    
    // Transmitir eliminación
    this.broadcastEvent('annotation_deleted', { annotationId })
    
    return true
  }

  focusOnAnnotation(annotationId: string) {
    const annotation = this.annotations.get(annotationId)
    if (!annotation) return
    
    const position = annotation.position
    this.viewer.navigation.setRequestTransitionWithUp(true, new THREE.Vector3(
      position.x + 5,
      position.y + 5,
      position.z + 5
    ), position, new THREE.Vector3(0, 0, 1))
  }

  sendChatMessage(message: string) {
    const chatData = {
      message: message,
      userId: this.userId,
      userName: 'Usuario Actual',
      timestamp: Date.now()
    }
    
    this.broadcastEvent('chat_message', chatData)
  }

  followCollaborator(collaboratorId: string) {
    const collaborator = this.collaborators.get(collaboratorId)
    if (!collaborator) return
    
    // Implementar seguimiento de cámara del colaborador
    this.broadcastEvent('follow_request', { collaboratorId })
  }

  shareViewpoint() {
    const camera = this.viewer.getCamera()
    const viewpointData = {
      position: camera.position,
      target: camera.target,
      up: camera.up,
      fov: camera.fov,
      userId: this.userId,
      userName: 'Usuario Actual',
      timestamp: Date.now()
    }
    
    this.broadcastEvent('viewpoint_shared', viewpointData)
  }

  toggleAnnotationVisibility(annotationId: string): boolean {
    const annotation = this.annotations.get(annotationId)
    if (!annotation) return false
    
    annotation.visible = !annotation.visible
    
    const overlayName = 'collaboration-annotations'
    const marker = this.viewer.impl.overlayScenes[overlayName]?.getObjectByName(`annotation_${annotationId}`)
    
    if (marker) {
      marker.visible = annotation.visible
      this.viewer.impl.invalidate(true)
    }
    
    return true
  }

  exportCollaborationData(): any {
    return {
      sessionId: this.sessionId,
      collaborators: Array.from(this.collaborators.values()),
      annotations: Array.from(this.annotations.values()),
      timestamp: new Date().toISOString()
    }
  }

  getSessionInfo(): any {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      isConnected: this.isConnected,
      collaboratorCount: this.collaborators.size,
      annotationCount: this.annotations.size
    }
  }
}

// Registrar la extensión
window.Autodesk.Viewing.theExtensionManager.registerExtension(
  'CollaborationExtension',
  CollaborationExtension
)

export default CollaborationExtension
