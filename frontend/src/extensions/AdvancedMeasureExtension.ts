// Extensión personalizada para mediciones avanzadas
export class AdvancedMeasureExtension extends window.Autodesk.Viewing.Extension {
  private measurements: Map<string, any> = new Map()
  private isActive = false
  private currentTool: string | null = null
  private onMeasurementCreated?: (measurement: any) => void
  private onMeasurementUpdated?: (measurement: any) => void
  private onMeasurementDeleted?: (measurementId: string) => void

  constructor(viewer: any, options: any) {
    super(viewer, options)
    this.name = 'AdvancedMeasureExtension'
    this.onMeasurementCreated = options.onMeasurementCreated
    this.onMeasurementUpdated = options.onMeasurementUpdated
    this.onMeasurementDeleted = options.onMeasurementDeleted
  }

  load() {
    console.log('AdvancedMeasureExtension loaded')
    this.setupEventListeners()
    return true
  }

  unload() {
    this.clearAllMeasurements()
    this.deactivate()
    console.log('AdvancedMeasureExtension unloaded')
    return true
  }

  // Configurar event listeners
  private setupEventListeners() {
    this.viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, this.onSelectionChanged.bind(this))
  }

  // Activar herramienta de medición
  activate(tool: 'distance' | 'area' | 'volume' | 'angle' | 'perimeter' | 'coordinate') {
    this.deactivate()
    this.isActive = true
    this.currentTool = tool
    
    switch (tool) {
      case 'distance':
        this.activateDistanceTool()
        break
      case 'area':
        this.activateAreaTool()
        break
      case 'volume':
        this.activateVolumeTool()
        break
      case 'angle':
        this.activateAngleTool()
        break
      case 'perimeter':
        this.activatePerimeterTool()
        break
      case 'coordinate':
        this.activateCoordinateTool()
        break
    }
  }

  // Desactivar herramienta
  deactivate() {
    this.isActive = false
    this.currentTool = null
    this.viewer.setActiveNavigationTool()
  }

  // Herramienta de medición de distancia
  private activateDistanceTool() {
    const tool = {
      name: 'advanced-distance',
      register: () => true,
      deregister: () => true,
      activate: () => {
        this.viewer.addEventListener('click', this.onDistanceClick.bind(this))
      },
      deactivate: () => {
        this.viewer.removeEventListener('click', this.onDistanceClick.bind(this))
      }
    }
    
    this.viewer.toolController.registerTool(tool)
    this.viewer.toolController.activateTool(tool.name)
  }

  // Herramienta de medición de área
  private activateAreaTool() {
    const tool = {
      name: 'advanced-area',
      register: () => true,
      deregister: () => true,
      activate: () => {
        this.viewer.addEventListener('click', this.onAreaClick.bind(this))
      },
      deactivate: () => {
        this.viewer.removeEventListener('click', this.onAreaClick.bind(this))
      }
    }
    
    this.viewer.toolController.registerTool(tool)
    this.viewer.toolController.activateTool(tool.name)
  }

  // Herramienta de medición de volumen
  private activateVolumeTool() {
    const tool = {
      name: 'advanced-volume',
      register: () => true,
      deregister: () => true,
      activate: () => {
        this.viewer.addEventListener('click', this.onVolumeClick.bind(this))
      },
      deactivate: () => {
        this.viewer.removeEventListener('click', this.onVolumeClick.bind(this))
      }
    }
    
    this.viewer.toolController.registerTool(tool)
    this.viewer.toolController.activateTool(tool.name)
  }

  // Herramienta de medición de ángulos
  private activateAngleTool() {
    const tool = {
      name: 'advanced-angle',
      register: () => true,
      deregister: () => true,
      activate: () => {
        this.viewer.addEventListener('click', this.onAngleClick.bind(this))
      },
      deactivate: () => {
        this.viewer.removeEventListener('click', this.onAngleClick.bind(this))
      }
    }
    
    this.viewer.toolController.registerTool(tool)
    this.viewer.toolController.activateTool(tool.name)
  }

  // Herramienta de medición de perímetro
  private activatePerimeterTool() {
    const tool = {
      name: 'advanced-perimeter',
      register: () => true,
      deregister: () => true,
      activate: () => {
        this.viewer.addEventListener('click', this.onPerimeterClick.bind(this))
      },
      deactivate: () => {
        this.viewer.removeEventListener('click', this.onPerimeterClick.bind(this))
      }
    }
    
    this.viewer.toolController.registerTool(tool)
    this.viewer.toolController.activateTool(tool.name)
  }

  // Herramienta de coordenadas
  private activateCoordinateTool() {
    const tool = {
      name: 'advanced-coordinate',
      register: () => true,
      deregister: () => true,
      activate: () => {
        this.viewer.addEventListener('click', this.onCoordinateClick.bind(this))
      },
      deactivate: () => {
        this.viewer.removeEventListener('click', this.onCoordinateClick.bind(this))
      }
    }
    
    this.viewer.toolController.registerTool(tool)
    this.viewer.toolController.activateTool(tool.name)
  }

  // Manejadores de eventos de clic
  private onDistanceClick(event: any) {
    const hitResult = this.viewer.impl.hitTest(event.canvasX, event.canvasY, false)
    if (hitResult) {
      this.createDistanceMeasurement(hitResult.intersectPoint)
    }
  }

  private onAreaClick(event: any) {
    const hitResult = this.viewer.impl.hitTest(event.canvasX, event.canvasY, false)
    if (hitResult) {
      this.createAreaMeasurement(hitResult.intersectPoint)
    }
  }

  private onVolumeClick(event: any) {
    const selection = this.viewer.getSelection()
    if (selection.length > 0) {
      this.createVolumeMeasurement(selection[0])
    }
  }

  private onAngleClick(event: any) {
    const hitResult = this.viewer.impl.hitTest(event.canvasX, event.canvasY, false)
    if (hitResult) {
      this.createAngleMeasurement(hitResult.intersectPoint)
    }
  }

  private onPerimeterClick(event: any) {
    const hitResult = this.viewer.impl.hitTest(event.canvasX, event.canvasY, false)
    if (hitResult) {
      this.createPerimeterMeasurement(hitResult.intersectPoint)
    }
  }

  private onCoordinateClick(event: any) {
    const hitResult = this.viewer.impl.hitTest(event.canvasX, event.canvasY, false)
    if (hitResult) {
      this.createCoordinateMeasurement(hitResult.intersectPoint)
    }
  }

  // Crear mediciones específicas
  private createDistanceMeasurement(point: THREE.Vector3) {
    const measurementId = this.generateMeasurementId()
    const measurement = {
      id: measurementId,
      type: 'distance',
      points: [point],
      value: 0,
      unit: 'm',
      label: 'Distancia',
      created: new Date(),
      visible: true
    }
    
    this.measurements.set(measurementId, measurement)
    this.visualizeMeasurement(measurement)
    this.onMeasurementCreated?.(measurement)
  }

  private createAreaMeasurement(point: THREE.Vector3) {
    const measurementId = this.generateMeasurementId()
    const measurement = {
      id: measurementId,
      type: 'area',
      points: [point],
      value: 0,
      unit: 'm²',
      label: 'Área',
      created: new Date(),
      visible: true
    }
    
    this.measurements.set(measurementId, measurement)
    this.visualizeMeasurement(measurement)
    this.onMeasurementCreated?.(measurement)
  }

  private createVolumeMeasurement(objectId: number) {
    const measurementId = this.generateMeasurementId()
    
    // Obtener bounding box del objeto
    const bbox = new THREE.Box3()
    const tree = this.viewer.model.getInstanceTree()
    
    if (tree) {
      tree.enumNodeFragments(objectId, (fragId: number) => {
        const fragBbox = new THREE.Box3()
        this.viewer.model.getFragmentList().getWorldBounds(fragId, fragBbox)
        bbox.union(fragBbox)
      })
    }
    
    const size = bbox.getSize(new THREE.Vector3())
    const volume = size.x * size.y * size.z
    
    const measurement = {
      id: measurementId,
      type: 'volume',
      objectId: objectId,
      bbox: bbox,
      value: volume,
      unit: 'm³',
      label: 'Volumen',
      created: new Date(),
      visible: true
    }
    
    this.measurements.set(measurementId, measurement)
    this.visualizeMeasurement(measurement)
    this.onMeasurementCreated?.(measurement)
  }

  private createAngleMeasurement(point: THREE.Vector3) {
    const measurementId = this.generateMeasurementId()
    const measurement = {
      id: measurementId,
      type: 'angle',
      points: [point],
      value: 0,
      unit: '°',
      label: 'Ángulo',
      created: new Date(),
      visible: true
    }
    
    this.measurements.set(measurementId, measurement)
    this.visualizeMeasurement(measurement)
    this.onMeasurementCreated?.(measurement)
  }

  private createPerimeterMeasurement(point: THREE.Vector3) {
    const measurementId = this.generateMeasurementId()
    const measurement = {
      id: measurementId,
      type: 'perimeter',
      points: [point],
      value: 0,
      unit: 'm',
      label: 'Perímetro',
      created: new Date(),
      visible: true
    }
    
    this.measurements.set(measurementId, measurement)
    this.visualizeMeasurement(measurement)
    this.onMeasurementCreated?.(measurement)
  }

  private createCoordinateMeasurement(point: THREE.Vector3) {
    const measurementId = this.generateMeasurementId()
    const measurement = {
      id: measurementId,
      type: 'coordinate',
      point: point,
      coordinates: {
        x: point.x,
        y: point.y,
        z: point.z
      },
      label: 'Coordenadas',
      created: new Date(),
      visible: true
    }
    
    this.measurements.set(measurementId, measurement)
    this.visualizeMeasurement(measurement)
    this.onMeasurementCreated?.(measurement)
  }

  // Visualizar medición en el viewer
  private visualizeMeasurement(measurement: any) {
    const overlayName = 'advanced-measurements'
    
    if (!this.viewer.impl.overlayScenes[overlayName]) {
      this.viewer.impl.createOverlayScene(overlayName)
    }
    
    switch (measurement.type) {
      case 'distance':
        this.visualizeDistanceMeasurement(measurement, overlayName)
        break
      case 'area':
        this.visualizeAreaMeasurement(measurement, overlayName)
        break
      case 'volume':
        this.visualizeVolumeMeasurement(measurement, overlayName)
        break
      case 'angle':
        this.visualizeAngleMeasurement(measurement, overlayName)
        break
      case 'perimeter':
        this.visualizePerimeterMeasurement(measurement, overlayName)
        break
      case 'coordinate':
        this.visualizeCoordinateMeasurement(measurement, overlayName)
        break
    }
  }

  private visualizeDistanceMeasurement(measurement: any, overlayName: string) {
    if (measurement.points.length >= 2) {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(measurement.points.length * 3)
      
      measurement.points.forEach((point: THREE.Vector3, index: number) => {
        positions[index * 3] = point.x
        positions[index * 3 + 1] = point.y
        positions[index * 3 + 2] = point.z
      })
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      
      const material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 })
      const line = new THREE.Line(geometry, material)
      line.name = `measurement_${measurement.id}`
      
      this.viewer.impl.addOverlay(overlayName, line)
      
      // Calcular y mostrar distancia
      if (measurement.points.length === 2) {
        const distance = measurement.points[0].distanceTo(measurement.points[1])
        measurement.value = distance
        this.addMeasurementLabel(measurement, overlayName)
      }
    }
  }

  private visualizeAreaMeasurement(measurement: any, overlayName: string) {
    if (measurement.points.length >= 3) {
      // Crear polígono para área
      const shape = new THREE.Shape()
      
      measurement.points.forEach((point: THREE.Vector3, index: number) => {
        if (index === 0) {
          shape.moveTo(point.x, point.y)
        } else {
          shape.lineTo(point.x, point.y)
        }
      })
      
      const geometry = new THREE.ShapeGeometry(shape)
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        transparent: true, 
        opacity: 0.3,
        side: THREE.DoubleSide
      })
      
      const mesh = new THREE.Mesh(geometry, material)
      mesh.name = `measurement_${measurement.id}`
      
      this.viewer.impl.addOverlay(overlayName, mesh)
      
      // Calcular área
      const area = this.calculatePolygonArea(measurement.points)
      measurement.value = area
      this.addMeasurementLabel(measurement, overlayName)
    }
  }

  private visualizeVolumeMeasurement(measurement: any, overlayName: string) {
    if (measurement.bbox) {
      const size = measurement.bbox.getSize(new THREE.Vector3())
      const center = measurement.bbox.getCenter(new THREE.Vector3())
      
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z)
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x0000ff, 
        transparent: true, 
        opacity: 0.2,
        wireframe: true
      })
      
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(center)
      mesh.name = `measurement_${measurement.id}`
      
      this.viewer.impl.addOverlay(overlayName, mesh)
      this.addMeasurementLabel(measurement, overlayName)
    }
  }

  private visualizeAngleMeasurement(measurement: any, overlayName: string) {
    if (measurement.points.length >= 3) {
      // Crear arco para mostrar el ángulo
      const center = measurement.points[1]
      const v1 = new THREE.Vector3().subVectors(measurement.points[0], center).normalize()
      const v2 = new THREE.Vector3().subVectors(measurement.points[2], center).normalize()
      
      const angle = v1.angleTo(v2)
      measurement.value = THREE.MathUtils.radToDeg(angle)
      
      const radius = 2
      const geometry = new THREE.RingGeometry(radius * 0.8, radius, 0, angle, 16)
      const material = new THREE.MeshBasicMaterial({ 
        color: 0xffff00, 
        transparent: true, 
        opacity: 0.5 
      })
      
      const arc = new THREE.Mesh(geometry, material)
      arc.position.copy(center)
      arc.name = `measurement_${measurement.id}`
      
      this.viewer.impl.addOverlay(overlayName, arc)
      this.addMeasurementLabel(measurement, overlayName)
    }
  }

  private visualizePerimeterMeasurement(measurement: any, overlayName: string) {
    if (measurement.points.length >= 2) {
      // Crear línea cerrada para perímetro
      const points = [...measurement.points, measurement.points[0]] // Cerrar el polígono
      
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(points.length * 3)
      
      points.forEach((point: THREE.Vector3, index: number) => {
        positions[index * 3] = point.x
        positions[index * 3 + 1] = point.y
        positions[index * 3 + 2] = point.z
      })
      
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      
      const material = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 })
      const line = new THREE.Line(geometry, material)
      line.name = `measurement_${measurement.id}`
      
      this.viewer.impl.addOverlay(overlayName, line)
      
      // Calcular perímetro
      const perimeter = this.calculatePerimeter(measurement.points)
      measurement.value = perimeter
      this.addMeasurementLabel(measurement, overlayName)
    }
  }

  private visualizeCoordinateMeasurement(measurement: any, overlayName: string) {
    const geometry = new THREE.SphereGeometry(0.2, 16, 16)
    const material = new THREE.MeshBasicMaterial({ color: 0x00ffff })
    
    const sphere = new THREE.Mesh(geometry, material)
    sphere.position.copy(measurement.point)
    sphere.name = `measurement_${measurement.id}`
    
    this.viewer.impl.addOverlay(overlayName, sphere)
    this.addMeasurementLabel(measurement, overlayName)
  }

  // Agregar etiqueta de medición
  private addMeasurementLabel(measurement: any, overlayName: string) {
    const labelText = this.formatMeasurementLabel(measurement)
    
    // Crear sprite de texto (implementación simplificada)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    canvas.width = 256
    canvas.height = 64
    
    context.fillStyle = 'rgba(0, 0, 0, 0.8)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    
    context.fillStyle = 'white'
    context.font = '16px Arial'
    context.textAlign = 'center'
    context.fillText(labelText, canvas.width / 2, canvas.height / 2)
    
    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(material)
    
    // Posicionar etiqueta
    const position = this.getMeasurementLabelPosition(measurement)
    sprite.position.copy(position)
    sprite.scale.set(2, 1, 1)
    sprite.name = `label_${measurement.id}`
    
    this.viewer.impl.addOverlay(overlayName, sprite)
  }

  // Formatear etiqueta de medición
  private formatMeasurementLabel(measurement: any): string {
    switch (measurement.type) {
      case 'distance':
        return `${measurement.value.toFixed(2)} ${measurement.unit}`
      case 'area':
        return `${measurement.value.toFixed(2)} ${measurement.unit}`
      case 'volume':
        return `${measurement.value.toFixed(2)} ${measurement.unit}`
      case 'angle':
        return `${measurement.value.toFixed(1)}${measurement.unit}`
      case 'perimeter':
        return `${measurement.value.toFixed(2)} ${measurement.unit}`
      case 'coordinate':
        return `(${measurement.coordinates.x.toFixed(2)}, ${measurement.coordinates.y.toFixed(2)}, ${measurement.coordinates.z.toFixed(2)})`
      default:
        return measurement.label
    }
  }

  // Obtener posición para la etiqueta
  private getMeasurementLabelPosition(measurement: any): THREE.Vector3 {
    switch (measurement.type) {
      case 'distance':
        if (measurement.points.length >= 2) {
          return new THREE.Vector3().addVectors(measurement.points[0], measurement.points[1]).multiplyScalar(0.5)
        }
        break
      case 'area':
      case 'perimeter':
        return this.calculateCentroid(measurement.points)
      case 'volume':
        return measurement.bbox.getCenter(new THREE.Vector3())
      case 'angle':
        return measurement.points[1] // Centro del ángulo
      case 'coordinate':
        return measurement.point.clone().add(new THREE.Vector3(0, 0, 1))
    }
    return new THREE.Vector3()
  }

  // Funciones de cálculo auxiliares
  private calculatePolygonArea(points: THREE.Vector3[]): number {
    if (points.length < 3) return 0
    
    let area = 0
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      area += points[i].x * points[j].y
      area -= points[j].x * points[i].y
    }
    return Math.abs(area) / 2
  }

  private calculatePerimeter(points: THREE.Vector3[]): number {
    let perimeter = 0
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length
      perimeter += points[i].distanceTo(points[j])
    }
    return perimeter
  }

  private calculateCentroid(points: THREE.Vector3[]): THREE.Vector3 {
    const centroid = new THREE.Vector3()
    points.forEach(point => centroid.add(point))
    return centroid.divideScalar(points.length)
  }

  private generateMeasurementId(): string {
    return `measurement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Manejador de cambio de selección
  private onSelectionChanged(event: any) {
    // Implementar lógica según necesidades
  }

  // API pública
  getAllMeasurements(): any[] {
    return Array.from(this.measurements.values())
  }

  getMeasurement(id: string): any | null {
    return this.measurements.get(id) || null
  }

  deleteMeasurement(id: string): boolean {
    const measurement = this.measurements.get(id)
    if (!measurement) return false
    
    // Remover visualización
    const overlayName = 'advanced-measurements'
    this.viewer.impl.removeOverlay(overlayName, `measurement_${id}`)
    this.viewer.impl.removeOverlay(overlayName, `label_${id}`)
    
    this.measurements.delete(id)
    this.onMeasurementDeleted?.(id)
    
    return true
  }

  clearAllMeasurements() {
    const overlayName = 'advanced-measurements'
    if (this.viewer.impl.overlayScenes[overlayName]) {
      this.viewer.impl.clearOverlay(overlayName)
    }
    
    this.measurements.clear()
  }

  toggleMeasurementVisibility(id: string): boolean {
    const measurement = this.measurements.get(id)
    if (!measurement) return false
    
    measurement.visible = !measurement.visible
    
    const overlayName = 'advanced-measurements'
    const measurementObj = this.viewer.impl.overlayScenes[overlayName].getObjectByName(`measurement_${id}`)
    const labelObj = this.viewer.impl.overlayScenes[overlayName].getObjectByName(`label_${id}`)
    
    if (measurementObj) measurementObj.visible = measurement.visible
    if (labelObj) labelObj.visible = measurement.visible
    
    this.viewer.impl.invalidate(true)
    this.onMeasurementUpdated?.(measurement)
    
    return true
  }

  exportMeasurements(format: 'json' | 'csv' = 'json'): string {
    const measurements = this.getAllMeasurements()
    
    if (format === 'json') {
      return JSON.stringify(measurements, null, 2)
    } else {
      const headers = ['ID', 'Tipo', 'Valor', 'Unidad', 'Etiqueta', 'Fecha', 'Visible']
      const rows = measurements.map(m => [
        m.id,
        m.type,
        m.value || '',
        m.unit || '',
        m.label,
        m.created.toISOString(),
        m.visible
      ])
      
      return [headers, ...rows].map(row => row.join(',')).join('\n')
    }
  }
}

// Registrar la extensión
window.Autodesk.Viewing.theExtensionManager.registerExtension(
  'AdvancedMeasureExtension',
  AdvancedMeasureExtension
)

export default AdvancedMeasureExtension
