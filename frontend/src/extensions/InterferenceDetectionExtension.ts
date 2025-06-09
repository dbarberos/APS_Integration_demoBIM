// Extensión personalizada para detección de interferencias
export class InterferenceDetectionExtension extends window.Autodesk.Viewing.Extension {
  private interferenceResults: any[] = []
  private isAnalyzing = false
  private onInterferenceDetected?: (interferences: any[]) => void

  constructor(viewer: any, options: any) {
    super(viewer, options)
    this.name = 'InterferenceDetectionExtension'
    this.onInterferenceDetected = options.onInterferenceDetected
  }

  load() {
    console.log('InterferenceDetectionExtension loaded')
    return true
  }

  unload() {
    this.clearInterferences()
    console.log('InterferenceDetectionExtension unloaded')
    return true
  }

  // Detectar interferencias entre modelos
  async detectInterferences(models: any[], tolerance: number = 0.01) {
    if (models.length < 2) {
      throw new Error('Se necesitan al menos 2 modelos para detectar interferencias')
    }

    this.isAnalyzing = true
    this.clearInterferences()

    try {
      const interferences = await this.performInterferenceAnalysis(models, tolerance)
      this.interferenceResults = interferences
      this.visualizeInterferences(interferences)
      
      this.onInterferenceDetected?.(interferences)
      
      return interferences
    } finally {
      this.isAnalyzing = false
    }
  }

  // Análisis de interferencias (implementación simplificada)
  private async performInterferenceAnalysis(models: any[], tolerance: number): Promise<any[]> {
    const interferences: any[] = []
    
    // Simular análisis de interferencias entre modelos
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const model1 = models[i]
        const model2 = models[j]
        
        // Obtener bounding boxes de ambos modelos
        const bbox1 = model1.getBoundingBox()
        const bbox2 = model2.getBoundingBox()
        
        // Verificar intersección básica
        if (this.boundingBoxesIntersect(bbox1, bbox2, tolerance)) {
          // Análisis más detallado (simplificado para demo)
          const detailedInterferences = await this.analyzeDetailedInterferences(model1, model2, tolerance)
          interferences.push(...detailedInterferences)
        }
      }
    }
    
    return interferences
  }

  // Verificar intersección de bounding boxes
  private boundingBoxesIntersect(bbox1: any, bbox2: any, tolerance: number): boolean {
    const min1 = bbox1.min
    const max1 = bbox1.max
    const min2 = bbox2.min
    const max2 = bbox2.max
    
    return !(
      max1.x + tolerance < min2.x ||
      max2.x + tolerance < min1.x ||
      max1.y + tolerance < min2.y ||
      max2.y + tolerance < min1.y ||
      max1.z + tolerance < min2.z ||
      max2.z + tolerance < min1.z
    )
  }

  // Análisis detallado de interferencias
  private async analyzeDetailedInterferences(model1: any, model2: any, tolerance: number): Promise<any[]> {
    const interferences: any[] = []
    
    // Obtener instancia tree de ambos modelos
    const tree1 = model1.getInstanceTree()
    const tree2 = model2.getInstanceTree()
    
    if (!tree1 || !tree2) return interferences
    
    // Simular detección de interferencias a nivel de fragmento
    // En una implementación real, esto sería mucho más complejo
    const fragments1 = this.getModelFragments(model1)
    const fragments2 = this.getModelFragments(model2)
    
    for (const frag1 of fragments1.slice(0, 10)) { // Limitar para demo
      for (const frag2 of fragments2.slice(0, 10)) {
        if (this.fragmentsIntersect(frag1, frag2, tolerance)) {
          interferences.push({
            id: `interference_${frag1.fragId}_${frag2.fragId}`,
            model1: model1.id,
            model2: model2.id,
            fragment1: frag1.fragId,
            fragment2: frag2.fragId,
            position: this.calculateInterferenceCenter(frag1, frag2),
            severity: this.calculateSeverity(frag1, frag2),
            volume: this.calculateInterferenceVolume(frag1, frag2),
            description: `Interferencia entre ${this.getFragmentName(tree1, frag1.fragId)} y ${this.getFragmentName(tree2, frag2.fragId)}`
          })
        }
      }
    }
    
    return interferences
  }

  // Obtener fragmentos del modelo
  private getModelFragments(model: any): any[] {
    const fragments: any[] = []
    const fragList = model.getFragmentList()
    
    if (fragList) {
      for (let i = 0; i < Math.min(fragList.fragments.length, 50); i++) { // Limitar para demo
        const bbox = new THREE.Box3()
        fragList.getWorldBounds(i, bbox)
        
        fragments.push({
          fragId: i,
          bbox: bbox,
          model: model
        })
      }
    }
    
    return fragments
  }

  // Verificar intersección de fragmentos
  private fragmentsIntersect(frag1: any, frag2: any, tolerance: number): boolean {
    return this.boundingBoxesIntersect(frag1.bbox, frag2.bbox, tolerance)
  }

  // Calcular centro de interferencia
  private calculateInterferenceCenter(frag1: any, frag2: any): { x: number, y: number, z: number } {
    const center1 = frag1.bbox.getCenter(new THREE.Vector3())
    const center2 = frag2.bbox.getCenter(new THREE.Vector3())
    
    return {
      x: (center1.x + center2.x) / 2,
      y: (center1.y + center2.y) / 2,
      z: (center1.z + center2.z) / 2
    }
  }

  // Calcular severidad de la interferencia
  private calculateSeverity(frag1: any, frag2: any): 'low' | 'medium' | 'high' {
    const vol1 = this.getBoundingBoxVolume(frag1.bbox)
    const vol2 = this.getBoundingBoxVolume(frag2.bbox)
    const ratio = Math.min(vol1, vol2) / Math.max(vol1, vol2)
    
    if (ratio > 0.7) return 'high'
    if (ratio > 0.3) return 'medium'
    return 'low'
  }

  // Calcular volumen de interferencia (simplificado)
  private calculateInterferenceVolume(frag1: any, frag2: any): number {
    const intersection = new THREE.Box3()
    intersection.copy(frag1.bbox).intersect(frag2.bbox)
    
    if (intersection.isEmpty()) return 0
    
    return this.getBoundingBoxVolume(intersection)
  }

  // Obtener volumen de bounding box
  private getBoundingBoxVolume(bbox: THREE.Box3): number {
    const size = bbox.getSize(new THREE.Vector3())
    return size.x * size.y * size.z
  }

  // Obtener nombre del fragmento
  private getFragmentName(tree: any, fragId: number): string {
    // Implementación simplificada
    return `Elemento ${fragId}`
  }

  // Visualizar interferencias en el viewer
  private visualizeInterferences(interferences: any[]) {
    this.clearInterferences()
    
    interferences.forEach((interference, index) => {
      this.createInterferenceMarker(interference, index)
    })
  }

  // Crear marcador de interferencia
  private createInterferenceMarker(interference: any, index: number) {
    const position = interference.position
    const severity = interference.severity
    
    // Crear geometría del marcador
    const geometry = new THREE.SphereGeometry(0.5, 16, 16)
    const material = new THREE.MeshBasicMaterial({
      color: severity === 'high' ? 0xff0000 : severity === 'medium' ? 0xffaa00 : 0xffff00,
      transparent: true,
      opacity: 0.8
    })
    
    const marker = new THREE.Mesh(geometry, material)
    marker.position.set(position.x, position.y, position.z)
    marker.name = `interference_marker_${index}`
    
    // Agregar al overlay scene
    this.viewer.impl.createOverlayScene('interference-markers')
    this.viewer.impl.addOverlay('interference-markers', marker)
    
    // Crear tooltip
    this.createInterferenceTooltip(marker, interference)
  }

  // Crear tooltip para interferencia
  private createInterferenceTooltip(marker: THREE.Mesh, interference: any) {
    // Implementación simplificada de tooltip
    const tooltip = document.createElement('div')
    tooltip.className = 'interference-tooltip'
    tooltip.innerHTML = `
      <div class="bg-red-500 text-white p-2 rounded shadow-lg text-xs">
        <div class="font-bold">Interferencia ${interference.severity.toUpperCase()}</div>
        <div>${interference.description}</div>
        <div>Volumen: ${interference.volume.toFixed(2)} m³</div>
      </div>
    `
    
    // Agregar evento de clic al marcador
    marker.userData = {
      tooltip: tooltip,
      interference: interference
    }
  }

  // Limpiar todas las interferencias visualizadas
  clearInterferences() {
    if (this.viewer.impl.overlayScenes['interference-markers']) {
      this.viewer.impl.clearOverlay('interference-markers')
    }
    this.interferenceResults = []
  }

  // Navegar a una interferencia específica
  focusOnInterference(interferenceId: string) {
    const interference = this.interferenceResults.find(i => i.id === interferenceId)
    if (!interference) return
    
    const position = interference.position
    const camera = this.viewer.getCamera()
    
    // Mover cámara a la interferencia
    camera.position.set(
      position.x + 10,
      position.y + 10,
      position.z + 10
    )
    camera.lookAt(new THREE.Vector3(position.x, position.y, position.z))
    camera.updateProjectionMatrix()
    
    this.viewer.impl.syncCamera()
    this.viewer.impl.invalidate(true)
  }

  // Obtener resultados de interferencias
  getInterferences(): any[] {
    return this.interferenceResults
  }

  // Verificar si está analizando
  isAnalyzingInterferences(): boolean {
    return this.isAnalyzing
  }

  // Exportar resultados de interferencias
  exportInterferences(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.interferenceResults, null, 2)
    } else {
      // Formato CSV
      const headers = ['ID', 'Modelo 1', 'Modelo 2', 'Severidad', 'Volumen', 'Descripción', 'X', 'Y', 'Z']
      const rows = this.interferenceResults.map(i => [
        i.id,
        i.model1,
        i.model2,
        i.severity,
        i.volume.toFixed(2),
        i.description,
        i.position.x.toFixed(2),
        i.position.y.toFixed(2),
        i.position.z.toFixed(2)
      ])
      
      return [headers, ...rows].map(row => row.join(',')).join('\n')
    }
  }
}

// Registrar la extensión
window.Autodesk.Viewing.theExtensionManager.registerExtension(
  'InterferenceDetectionExtension',
  InterferenceDetectionExtension
)

export default InterferenceDetectionExtension
