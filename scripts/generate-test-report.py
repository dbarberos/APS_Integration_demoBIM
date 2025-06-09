#!/usr/bin/env python3
"""
Script para generar reportes de testing y métricas de calidad
"""

import json
import os
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
import subprocess
import argparse


class TestReportGenerator:
    """Generador de reportes de testing"""
    
    def __init__(self, reports_dir="reports"):
        self.reports_dir = Path(reports_dir)
        self.reports_dir.mkdir(exist_ok=True)
        self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
    def parse_backend_coverage(self):
        """Parsear cobertura del backend"""
        coverage_file = Path("backend/coverage.json")
        if not coverage_file.exists():
            return None
            
        try:
            with open(coverage_file) as f:
                coverage_data = json.load(f)
                
            total_coverage = coverage_data.get("totals", {})
            return {
                "statements": total_coverage.get("num_statements", 0),
                "missing": total_coverage.get("missing_lines", 0),
                "coverage_percent": total_coverage.get("percent_covered", 0),
                "files": len(coverage_data.get("files", {}))
            }
        except Exception as e:
            print(f"Error parsing backend coverage: {e}")
            return None
    
    def parse_frontend_coverage(self):
        """Parsear cobertura del frontend"""
        coverage_file = Path("frontend/coverage/coverage-summary.json")
        if not coverage_file.exists():
            return None
            
        try:
            with open(coverage_file) as f:
                coverage_data = json.load(f)
                
            total = coverage_data.get("total", {})
            return {
                "lines": total.get("lines", {}).get("pct", 0),
                "statements": total.get("statements", {}).get("pct", 0),
                "functions": total.get("functions", {}).get("pct", 0),
                "branches": total.get("branches", {}).get("pct", 0)
            }
        except Exception as e:
            print(f"Error parsing frontend coverage: {e}")
            return None
    
    def parse_junit_results(self, junit_file):
        """Parsear resultados JUnit XML"""
        if not Path(junit_file).exists():
            return None
            
        try:
            tree = ET.parse(junit_file)
            root = tree.getroot()
            
            # Handle different JUnit XML formats
            if root.tag == 'testsuite':
                testsuites = [root]
            else:
                testsuites = root.findall('testsuite')
            
            total_tests = 0
            total_failures = 0
            total_errors = 0
            total_skipped = 0
            total_time = 0
            
            for testsuite in testsuites:
                total_tests += int(testsuite.get('tests', 0))
                total_failures += int(testsuite.get('failures', 0))
                total_errors += int(testsuite.get('errors', 0))
                total_skipped += int(testsuite.get('skipped', 0))
                total_time += float(testsuite.get('time', 0))
            
            return {
                "total_tests": total_tests,
                "failures": total_failures,
                "errors": total_errors,
                "skipped": total_skipped,
                "success_rate": ((total_tests - total_failures - total_errors) / total_tests * 100) if total_tests > 0 else 0,
                "execution_time": total_time
            }
        except Exception as e:
            print(f"Error parsing JUnit file {junit_file}: {e}")
            return None
    
    def parse_locust_results(self):
        """Parsear resultados de Locust"""
        stats_file = self.reports_dir / "load-test_stats.csv"
        if not stats_file.exists():
            return None
            
        try:
            import csv
            
            with open(stats_file, 'r') as f:
                reader = csv.DictReader(f)
                stats = list(reader)
            
            # Get aggregate stats (last row usually contains totals)
            if stats and 'Aggregated' in stats[-1].get('Name', ''):
                total_stats = stats[-1]
                return {
                    "total_requests": int(total_stats.get('Request Count', 0)),
                    "failure_count": int(total_stats.get('Failure Count', 0)),
                    "avg_response_time": float(total_stats.get('Average Response Time', 0)),
                    "min_response_time": float(total_stats.get('Min Response Time', 0)),
                    "max_response_time": float(total_stats.get('Max Response Time', 0)),
                    "rps": float(total_stats.get('Requests/s', 0)),
                    "failure_rate": float(total_stats.get('Failure Count', 0)) / max(int(total_stats.get('Request Count', 1)), 1) * 100
                }
        except Exception as e:
            print(f"Error parsing Locust results: {e}")
            return None
    
    def get_security_summary(self):
        """Obtener resumen de seguridad"""
        security_data = {}
        
        # Bandit results
        bandit_file = self.reports_dir / "security-bandit.json"
        if bandit_file.exists():
            try:
                with open(bandit_file) as f:
                    bandit_data = json.load(f)
                security_data["bandit"] = {
                    "high_severity": len([r for r in bandit_data.get("results", []) if r.get("issue_severity") == "HIGH"]),
                    "medium_severity": len([r for r in bandit_data.get("results", []) if r.get("issue_severity") == "MEDIUM"]),
                    "low_severity": len([r for r in bandit_data.get("results", []) if r.get("issue_severity") == "LOW"]),
                    "total_issues": len(bandit_data.get("results", []))
                }
            except:
                pass
        
        # npm audit results
        npm_audit_file = self.reports_dir / "npm-audit.json"
        if npm_audit_file.exists():
            try:
                with open(npm_audit_file) as f:
                    npm_data = json.load(f)
                vulnerabilities = npm_data.get("vulnerabilities", {})
                security_data["npm_audit"] = {
                    "critical": sum(1 for v in vulnerabilities.values() if v.get("severity") == "critical"),
                    "high": sum(1 for v in vulnerabilities.values() if v.get("severity") == "high"),
                    "moderate": sum(1 for v in vulnerabilities.values() if v.get("severity") == "moderate"),
                    "low": sum(1 for v in vulnerabilities.values() if v.get("severity") == "low"),
                    "total": len(vulnerabilities)
                }
            except:
                pass
        
        return security_data
    
    def generate_html_report(self, data):
        """Generar reporte HTML completo"""
        html_template = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Testing APS - {timestamp}</title>
    <style>
        body {{ 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f7fa; 
            color: #333;
        }}
        .container {{ 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{ 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 30px; 
            text-align: center; 
        }}
        .header h1 {{ margin: 0; font-size: 2.5em; }}
        .header p {{ margin: 10px 0 0; opacity: 0.9; }}
        .section {{ 
            padding: 30px; 
            border-bottom: 1px solid #eee; 
        }}
        .section:last-child {{ border-bottom: none; }}
        .section h2 {{ 
            color: #667eea; 
            margin-top: 0; 
            border-bottom: 2px solid #667eea; 
            padding-bottom: 10px;
        }}
        .metrics-grid {{ 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; 
            margin: 20px 0; 
        }}
        .metric-card {{ 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            border-left: 4px solid #667eea;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .metric-value {{ 
            font-size: 2em; 
            font-weight: bold; 
            color: #667eea; 
        }}
        .metric-label {{ 
            color: #666; 
            margin-top: 5px; 
        }}
        .status-good {{ color: #28a745; }}
        .status-warning {{ color: #ffc107; }}
        .status-error {{ color: #dc3545; }}
        .progress-bar {{ 
            width: 100%; 
            height: 20px; 
            background: #e9ecef; 
            border-radius: 10px; 
            overflow: hidden; 
            margin: 10px 0;
        }}
        .progress-fill {{ 
            height: 100%; 
            background: linear-gradient(90deg, #28a745, #20c997); 
            transition: width 0.3s ease;
        }}
        .test-results {{ 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 20px; 
        }}
        .test-category {{ 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            border: 1px solid #dee2e6;
        }}
        .test-category h3 {{ 
            margin-top: 0; 
            color: #495057; 
        }}
        .security-summary {{ 
            background: #fff3cd; 
            border: 1px solid #ffeaa7; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0;
        }}
        .recommendations {{ 
            background: #d1ecf1; 
            border: 1px solid #bee5eb; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0;
        }}
        .recommendations ul {{ 
            margin: 10px 0; 
            padding-left: 20px; 
        }}
        .chart-container {{ 
            width: 100%; 
            height: 300px; 
            margin: 20px 0; 
        }}
        .footer {{ 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            color: #666; 
            font-size: 0.9em;
        }}
        .badge {{ 
            display: inline-block; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 0.8em; 
            font-weight: bold; 
            margin: 2px;
        }}
        .badge-success {{ background: #d4edda; color: #155724; }}
        .badge-warning {{ background: #fff3cd; color: #856404; }}
        .badge-danger {{ background: #f8d7da; color: #721c24; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Reporte de Testing APS</h1>
            <p>Generado: {timestamp}</p>
            <p>Cobertura Total: {total_coverage}%</p>
        </div>

        <div class="section">
            <h2>📊 Resumen Ejecutivo</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value {backend_coverage_status}">{backend_coverage}%</div>
                    <div class="metric-label">Cobertura Backend</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {backend_coverage}%"></div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-value {frontend_coverage_status}">{frontend_coverage}%</div>
                    <div class="metric-label">Cobertura Frontend</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {frontend_coverage}%"></div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-value {test_success_status}">{test_success_rate}%</div>
                    <div class="metric-label">Tests Exitosos</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {test_success_rate}%"></div>
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-value {performance_status}">{avg_response_time}ms</div>
                    <div class="metric-label">Tiempo Respuesta Promedio</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔧 Resultados de Tests</h2>
            <div class="test-results">
                <div class="test-category">
                    <h3>Backend Tests</h3>
                    {backend_results}
                </div>
                <div class="test-category">
                    <h3>Frontend Tests</h3>
                    {frontend_results}
                </div>
                <div class="test-category">
                    <h3>E2E Tests</h3>
                    {e2e_results}
                </div>
                <div class="test-category">
                    <h3>Performance Tests</h3>
                    {performance_results}
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🔒 Resumen de Seguridad</h2>
            <div class="security-summary">
                {security_summary}
            </div>
        </div>

        <div class="section">
            <h2>💡 Recomendaciones</h2>
            <div class="recommendations">
                {recommendations}
            </div>
        </div>

        <div class="footer">
            <p>Reporte generado automáticamente por el sistema de CI/CD</p>
            <p>Para más detalles, consulte los reportes específicos de cada herramienta</p>
        </div>
    </div>
</body>
</html>
        """
        
        return html_template.format(**data)
    
    def calculate_quality_score(self, data):
        """Calcular score de calidad general"""
        score = 0
        max_score = 100
        
        # Coverage score (40 points)
        backend_cov = data.get("backend_coverage", {}).get("coverage_percent", 0)
        frontend_cov_lines = data.get("frontend_coverage", {}).get("lines", 0)
        avg_coverage = (backend_cov + frontend_cov_lines) / 2
        coverage_score = min(40, avg_coverage * 0.4)
        score += coverage_score
        
        # Test success rate (30 points)
        success_rates = []
        for test_type in ["backend_tests", "frontend_tests", "e2e_tests"]:
            if test_type in data and data[test_type]:
                success_rates.append(data[test_type].get("success_rate", 0))
        
        if success_rates:
            avg_success = sum(success_rates) / len(success_rates)
            success_score = min(30, avg_success * 0.3)
            score += success_score
        
        # Performance score (20 points)
        performance = data.get("performance_tests")
        if performance:
            avg_response = performance.get("avg_response_time", 3000)
            if avg_response <= 1000:
                perf_score = 20
            elif avg_response <= 2000:
                perf_score = 15
            elif avg_response <= 3000:
                perf_score = 10
            else:
                perf_score = 5
            score += perf_score
        
        # Security score (10 points)
        security = data.get("security")
        if security:
            total_critical = 0
            for tool in security.values():
                total_critical += tool.get("critical", 0) + tool.get("high_severity", 0)
            
            if total_critical == 0:
                sec_score = 10
            elif total_critical <= 3:
                sec_score = 7
            elif total_critical <= 5:
                sec_score = 5
            else:
                sec_score = 2
            score += sec_score
        
        return min(100, score)
    
    def generate_recommendations(self, data):
        """Generar recomendaciones basadas en los resultados"""
        recommendations = []
        
        # Coverage recommendations
        backend_cov = data.get("backend_coverage", {}).get("coverage_percent", 0)
        if backend_cov < 90:
            recommendations.append(f"Aumentar cobertura del backend del {backend_cov:.1f}% al 90%+")
        
        frontend_cov = data.get("frontend_coverage", {}).get("lines", 0)
        if frontend_cov < 80:
            recommendations.append(f"Aumentar cobertura del frontend del {frontend_cov:.1f}% al 80%+")
        
        # Performance recommendations
        performance = data.get("performance_tests")
        if performance:
            avg_response = performance.get("avg_response_time", 0)
            failure_rate = performance.get("failure_rate", 0)
            
            if avg_response > 2000:
                recommendations.append("Optimizar tiempo de respuesta de las APIs (target: <2000ms)")
            if failure_rate > 5:
                recommendations.append(f"Reducir tasa de fallos del {failure_rate:.1f}% al <5%")
        
        # Security recommendations
        security = data.get("security", {})
        for tool, results in security.items():
            if tool == "bandit":
                high_issues = results.get("high_severity", 0)
                if high_issues > 0:
                    recommendations.append(f"Resolver {high_issues} problemas de seguridad críticos (Bandit)")
            elif tool == "npm_audit":
                critical = results.get("critical", 0)
                if critical > 0:
                    recommendations.append(f"Actualizar {critical} dependencias con vulnerabilidades críticas")
        
        # Test quality recommendations
        for test_type in ["backend_tests", "frontend_tests", "e2e_tests"]:
            test_data = data.get(test_type)
            if test_data:
                success_rate = test_data.get("success_rate", 100)
                if success_rate < 95:
                    recommendations.append(f"Mejorar estabilidad de {test_type.replace('_', ' ')}: {success_rate:.1f}% -> 95%+")
        
        return recommendations
    
    def run(self):
        """Ejecutar generación de reporte"""
        print("🧪 Generando reporte de testing...")
        
        # Recopilar datos
        data = {
            "timestamp": self.timestamp,
            "backend_coverage": self.parse_backend_coverage(),
            "frontend_coverage": self.parse_frontend_coverage(),
            "backend_tests": self.parse_junit_results(self.reports_dir / "backend-junit.xml"),
            "frontend_tests": self.parse_junit_results(self.reports_dir / "frontend-junit.xml"),
            "e2e_tests": self.parse_junit_results(self.reports_dir / "e2e-junit.xml"),
            "performance_tests": self.parse_locust_results(),
            "security": self.get_security_summary()
        }
        
        # Calcular métricas derivadas
        backend_cov = data["backend_coverage"]["coverage_percent"] if data["backend_coverage"] else 0
        frontend_cov = data["frontend_coverage"]["lines"] if data["frontend_coverage"] else 0
        total_coverage = (backend_cov + frontend_cov) / 2
        
        # Calcular tasa de éxito de tests
        success_rates = []
        for test_type in ["backend_tests", "frontend_tests", "e2e_tests"]:
            if data[test_type]:
                success_rates.append(data[test_type]["success_rate"])
        avg_success_rate = sum(success_rates) / len(success_rates) if success_rates else 0
        
        # Preparar datos para template
        template_data = {
            "timestamp": self.timestamp,
            "total_coverage": f"{total_coverage:.1f}",
            "backend_coverage": f"{backend_cov:.1f}",
            "frontend_coverage": f"{frontend_cov:.1f}",
            "test_success_rate": f"{avg_success_rate:.1f}",
            "avg_response_time": data["performance_tests"]["avg_response_time"] if data["performance_tests"] else "N/A",
            
            # Status classes for coloring
            "backend_coverage_status": "status-good" if backend_cov >= 90 else "status-warning" if backend_cov >= 80 else "status-error",
            "frontend_coverage_status": "status-good" if frontend_cov >= 80 else "status-warning" if frontend_cov >= 70 else "status-error",
            "test_success_status": "status-good" if avg_success_rate >= 95 else "status-warning" if avg_success_rate >= 90 else "status-error",
            "performance_status": "status-good" if (data["performance_tests"] and data["performance_tests"]["avg_response_time"] <= 2000) else "status-warning",
            
            # Detailed results sections
            "backend_results": self.format_test_results(data["backend_tests"]),
            "frontend_results": self.format_test_results(data["frontend_tests"]),
            "e2e_results": self.format_test_results(data["e2e_tests"]),
            "performance_results": self.format_performance_results(data["performance_tests"]),
            "security_summary": self.format_security_summary(data["security"]),
            "recommendations": self.format_recommendations(self.generate_recommendations(data))
        }
        
        # Generar reporte HTML
        html_content = self.generate_html_report(template_data)
        
        # Guardar reporte
        report_file = self.reports_dir / "comprehensive-test-report.html"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Generar reporte JSON
        json_report = self.reports_dir / "test-summary.json"
        with open(json_report, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        # Calcular score de calidad
        quality_score = self.calculate_quality_score(data)
        
        print(f"✅ Reporte generado exitosamente:")
        print(f"   📄 HTML: {report_file}")
        print(f"   📊 JSON: {json_report}")
        print(f"   🏆 Score de Calidad: {quality_score:.1f}/100")
        
        if quality_score >= 90:
            print("🎉 ¡Excelente calidad de código!")
        elif quality_score >= 80:
            print("👍 Buena calidad de código")
        elif quality_score >= 70:
            print("⚠️  Calidad de código mejorable")
        else:
            print("🚨 Calidad de código requiere atención inmediata")
        
        return quality_score
    
    def format_test_results(self, test_data):
        """Formatear resultados de tests para HTML"""
        if not test_data:
            return "<p>No hay datos disponibles</p>"
        
        return f"""
        <p><strong>Total Tests:</strong> {test_data['total_tests']}</p>
        <p><strong>Exitosos:</strong> {test_data['total_tests'] - test_data['failures'] - test_data['errors']}</p>
        <p><strong>Fallos:</strong> {test_data['failures']}</p>
        <p><strong>Errores:</strong> {test_data['errors']}</p>
        <p><strong>Omitidos:</strong> {test_data['skipped']}</p>
        <p><strong>Tasa de Éxito:</strong> {test_data['success_rate']:.1f}%</p>
        <p><strong>Tiempo de Ejecución:</strong> {test_data['execution_time']:.2f}s</p>
        """
    
    def format_performance_results(self, perf_data):
        """Formatear resultados de performance para HTML"""
        if not perf_data:
            return "<p>No hay datos de performance disponibles</p>"
        
        return f"""
        <p><strong>Requests Totales:</strong> {perf_data['total_requests']}</p>
        <p><strong>Fallos:</strong> {perf_data['failure_count']}</p>
        <p><strong>Tasa de Fallos:</strong> {perf_data['failure_rate']:.2f}%</p>
        <p><strong>Tiempo Respuesta Promedio:</strong> {perf_data['avg_response_time']:.2f}ms</p>
        <p><strong>Tiempo Respuesta Máximo:</strong> {perf_data['max_response_time']:.2f}ms</p>
        <p><strong>Requests por Segundo:</strong> {perf_data['rps']:.2f}</p>
        """
    
    def format_security_summary(self, security_data):
        """Formatear resumen de seguridad para HTML"""
        if not security_data:
            return "<p>No hay datos de seguridad disponibles</p>"
        
        html = ""
        for tool, results in security_data.items():
            if tool == "bandit":
                html += f"""
                <h4>Bandit (Backend Security)</h4>
                <p>Críticos: {results.get('high_severity', 0)} | 
                   Medios: {results.get('medium_severity', 0)} | 
                   Bajos: {results.get('low_severity', 0)}</p>
                """
            elif tool == "npm_audit":
                html += f"""
                <h4>NPM Audit (Frontend Security)</h4>
                <p>Críticos: {results.get('critical', 0)} | 
                   Altos: {results.get('high', 0)} | 
                   Moderados: {results.get('moderate', 0)} | 
                   Bajos: {results.get('low', 0)}</p>
                """
        
        return html or "<p>No se ejecutaron análisis de seguridad</p>"
    
    def format_recommendations(self, recommendations):
        """Formatear recomendaciones para HTML"""
        if not recommendations:
            return "<p>🎉 ¡No hay recomendaciones! El código cumple con todos los estándares de calidad.</p>"
        
        html = "<ul>"
        for rec in recommendations:
            html += f"<li>{rec}</li>"
        html += "</ul>"
        
        return html


def main():
    """Función principal"""
    parser = argparse.ArgumentParser(description="Generar reporte de testing APS")
    parser.add_argument("--reports-dir", default="reports", help="Directorio de reportes")
    parser.add_argument("--output", help="Archivo de salida específico")
    parser.add_argument("--format", choices=["html", "json", "both"], default="both", help="Formato de salida")
    parser.add_argument("--fail-on-low-quality", action="store_true", help="Fallar si la calidad es baja")
    parser.add_argument("--quality-threshold", type=int, default=80, help="Umbral mínimo de calidad")
    
    args = parser.parse_args()
    
    try:
        generator = TestReportGenerator(args.reports_dir)
        quality_score = generator.run()
        
        if args.fail_on_low_quality and quality_score < args.quality_threshold:
            print(f"❌ Calidad insuficiente: {quality_score:.1f} < {args.quality_threshold}")
            sys.exit(1)
        
        print("✅ Generación de reporte completada exitosamente")
        
    except Exception as e:
        print(f"❌ Error generando reporte: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
