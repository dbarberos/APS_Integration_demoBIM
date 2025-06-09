"""
Tests de carga con Locust para la aplicación APS
"""
import random
import time
import json
import base64
from io import BytesIO

from locust import HttpUser, task, between, events
from locust.exception import StopUser


class APSUser(HttpUser):
    """Usuario simulado para tests de carga"""
    
    wait_time = between(1, 3)  # Tiempo de espera entre requests
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.token = None
        self.user_id = None
        self.projects = []
        self.files = []
        self.translation_jobs = []
    
    def on_start(self):
        """Configuración inicial al iniciar el usuario"""
        self.login()
        self.create_test_project()
    
    def login(self):
        """Autenticación del usuario"""
        user_num = random.randint(1, 1000)
        credentials = {
            "username": f"testuser{user_num}@example.com",
            "password": "testpassword123"
        }
        
        with self.client.post(
            "/api/v1/auth/login",
            json=credentials,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                
                # Configure headers for subsequent requests
                self.client.headers.update({
                    "Authorization": f"Bearer {self.token}"
                })
                
                response.success()
            else:
                response.failure(f"Login failed: {response.status_code}")
                raise StopUser()
    
    def create_test_project(self):
        """Crear proyecto de prueba"""
        project_data = {
            "name": f"Load Test Project {random.randint(1, 10000)}",
            "description": "Created by Locust load test"
        }
        
        with self.client.post(
            "/api/v1/projects/",
            json=project_data,
            catch_response=True
        ) as response:
            if response.status_code == 201:
                project = response.json()
                self.projects.append(project)
                response.success()
            else:
                response.failure(f"Project creation failed: {response.status_code}")
    
    @task(3)
    def view_dashboard(self):
        """Visualizar dashboard"""
        with self.client.get("/api/v1/stats/dashboard", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Dashboard failed: {response.status_code}")
    
    @task(5)
    def list_projects(self):
        """Listar proyectos"""
        params = {
            "page": random.randint(1, 3),
            "per_page": random.choice([10, 25, 50]),
            "search": random.choice(["", "test", "project"])
        }
        
        with self.client.get(
            "/api/v1/projects/",
            params=params,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                # Update projects list
                if data.get("data"):
                    self.projects.extend(data["data"][:3])  # Keep only first 3
                response.success()
            else:
                response.failure(f"Projects list failed: {response.status_code}")
    
    @task(4)
    def list_files(self):
        """Listar archivos"""
        params = {
            "page": random.randint(1, 3),
            "per_page": random.choice([10, 25]),
            "status": random.choice(["", "uploaded", "processing"]),
        }
        
        if self.projects:
            params["project_id"] = random.choice(self.projects)["id"]
        
        with self.client.get(
            "/api/v1/files/",
            params=params,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("data"):
                    self.files.extend(data["data"][:3])
                response.success()
            else:
                response.failure(f"Files list failed: {response.status_code}")
    
    @task(2)
    def upload_file(self):
        """Simular upload de archivo"""
        if not self.projects:
            return
        
        # Simular contenido de archivo CAD
        file_content = b"Simulated CAD file content " * 1000  # ~27KB
        file_name = f"test_model_{random.randint(1, 10000)}.rvt"
        
        files = {
            "file": (file_name, BytesIO(file_content), "application/octet-stream")
        }
        data = {
            "project_id": str(random.choice(self.projects)["id"])
        }
        
        with self.client.post(
            "/api/v1/files/upload",
            files=files,
            data=data,
            catch_response=True
        ) as response:
            if response.status_code == 201:
                file_data = response.json()
                self.files.append(file_data)
                response.success()
            else:
                response.failure(f"File upload failed: {response.status_code}")
    
    @task(2)
    def start_translation(self):
        """Iniciar traducción"""
        if not self.files:
            return
        
        file_obj = random.choice(self.files)
        translation_data = {
            "file_id": file_obj["id"],
            "output_formats": random.choice([
                ["svf2"],
                ["svf2", "thumbnail"],
                ["svf2", "stl"],
                ["thumbnail"]
            ]),
            "priority": random.choice(["low", "normal", "high"]),
            "quality_level": random.choice(["low", "medium", "high"])
        }
        
        with self.client.post(
            "/api/v1/translate/",
            json=translation_data,
            catch_response=True
        ) as response:
            if response.status_code == 201:
                job_data = response.json()
                self.translation_jobs.append(job_data)
                response.success()
            else:
                response.failure(f"Translation start failed: {response.status_code}")
    
    @task(3)
    def list_translations(self):
        """Listar trabajos de traducción"""
        params = {
            "page": random.randint(1, 2),
            "per_page": random.choice([10, 25]),
            "status": random.choice(["", "pending", "inprogress", "success", "failed"]),
            "priority": random.choice(["", "low", "normal", "high"])
        }
        
        with self.client.get(
            "/api/v1/translate/",
            params=params,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                data = response.json()
                if data.get("data"):
                    self.translation_jobs.extend(data["data"][:3])
                response.success()
            else:
                response.failure(f"Translations list failed: {response.status_code}")
    
    @task(2)
    def check_translation_status(self):
        """Verificar estado de traducción"""
        if not self.translation_jobs:
            return
        
        job = random.choice(self.translation_jobs)
        
        with self.client.get(
            f"/api/v1/translate/{job['id']}/status",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 404:
                # Job might not exist, remove from list
                self.translation_jobs = [j for j in self.translation_jobs if j['id'] != job['id']]
                response.success()
            else:
                response.failure(f"Translation status failed: {response.status_code}")
    
    @task(1)
    def get_translation_manifest(self):
        """Obtener manifiesto de traducción"""
        if not self.translation_jobs:
            return
        
        job = random.choice(self.translation_jobs)
        
        with self.client.get(
            f"/api/v1/translate/{job['id']}/manifest",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 404:
                response.success()  # Job might not exist or not ready
            else:
                response.failure(f"Translation manifest failed: {response.status_code}")
    
    @task(1)
    def update_project(self):
        """Actualizar proyecto"""
        if not self.projects:
            return
        
        project = random.choice(self.projects)
        update_data = {
            "description": f"Updated by load test at {time.time()}"
        }
        
        with self.client.patch(
            f"/api/v1/projects/{project['id']}",
            json=update_data,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Project update failed: {response.status_code}")
    
    @task(1)
    def delete_file(self):
        """Eliminar archivo (ocasionalmente)"""
        if len(self.files) > 5:  # Only delete if we have many files
            file_to_delete = self.files.pop()
            
            with self.client.delete(
                f"/api/v1/files/{file_to_delete['id']}",
                catch_response=True
            ) as response:
                if response.status_code == 204:
                    response.success()
                else:
                    response.failure(f"File deletion failed: {response.status_code}")


class HeavyAPSUser(HttpUser):
    """Usuario con carga pesada para stress testing"""
    
    wait_time = between(0.5, 1.5)
    weight = 1  # Lower weight so fewer of these users
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.token = None
    
    def on_start(self):
        self.login()
    
    def login(self):
        """Autenticación rápida"""
        credentials = {
            "username": f"heavyuser{random.randint(1, 100)}@example.com",
            "password": "testpassword123"
        }
        
        response = self.client.post("/api/v1/auth/login", json=credentials)
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})
    
    @task(5)
    def rapid_api_calls(self):
        """Realizar múltiples llamadas API rápidas"""
        endpoints = [
            "/api/v1/projects/",
            "/api/v1/files/",
            "/api/v1/translate/",
            "/api/v1/stats/dashboard"
        ]
        
        for endpoint in endpoints:
            self.client.get(endpoint)
            time.sleep(0.1)  # Very short delay
    
    @task(2)
    def large_file_upload(self):
        """Simular upload de archivo grande"""
        # Simular archivo de 10MB
        large_file_content = b"Large CAD file content " * 50000  # ~1.2MB
        file_name = f"large_model_{random.randint(1, 1000)}.rvt"
        
        files = {
            "file": (file_name, BytesIO(large_file_content), "application/octet-stream")
        }
        data = {"project_id": "1"}  # Assume project exists
        
        with self.client.post(
            "/api/v1/files/upload",
            files=files,
            data=data,
            catch_response=True,
            timeout=30
        ) as response:
            if response.status_code == 201:
                response.success()
            else:
                response.failure(f"Large file upload failed: {response.status_code}")


class ViewerUser(HttpUser):
    """Usuario especializado en operaciones de viewer"""
    
    wait_time = between(2, 5)
    weight = 2
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.token = None
        self.urns = []
    
    def on_start(self):
        self.login()
        self.get_available_urns()
    
    def login(self):
        credentials = {
            "username": f"viewer{random.randint(1, 50)}@example.com",
            "password": "testpassword123"
        }
        
        response = self.client.post("/api/v1/auth/login", json=credentials)
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def get_available_urns(self):
        """Obtener URNs disponibles para viewer"""
        response = self.client.get("/api/v1/translate/?status=success")
        if response.status_code == 200:
            jobs = response.json().get("data", [])
            self.urns = [job["urn"] for job in jobs if job.get("urn")]
    
    @task(3)
    def get_viewer_token(self):
        """Obtener token para viewer"""
        if not self.urns:
            return
        
        urn = random.choice(self.urns)
        with self.client.get(
            f"/api/v1/viewer/token/{urn}",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Viewer token failed: {response.status_code}")
    
    @task(2)
    def get_model_metadata(self):
        """Obtener metadatos del modelo"""
        if not self.urns:
            return
        
        urn = random.choice(self.urns)
        job_id = f"job-{urn[-10:]}"  # Simulate job ID
        
        with self.client.get(
            f"/api/v1/translate/{job_id}/metadata",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.success()  # Might not exist, that's ok


# Event handlers for performance monitoring
@events.request.add_listener
def record_request_metrics(request_type, name, response_time, response_length, exception, **kwargs):
    """Registrar métricas de requests"""
    if exception:
        print(f"Request failed: {name} - {exception}")
    elif response_time > 5000:  # Log slow requests (>5 seconds)
        print(f"Slow request: {name} - {response_time}ms")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Configuración al iniciar tests"""
    print("Starting APS load test...")
    print(f"Target host: {environment.host}")
    print(f"Users: {environment.runner.target_user_count if hasattr(environment.runner, 'target_user_count') else 'Unknown'}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Reporte final al terminar tests"""
    print("Load test completed!")
    
    stats = environment.runner.stats
    print(f"Total requests: {stats.total.num_requests}")
    print(f"Failed requests: {stats.total.num_failures}")
    print(f"Average response time: {stats.total.avg_response_time:.2f}ms")
    print(f"95th percentile: {stats.total.get_response_time_percentile(0.95):.2f}ms")
    
    # Check performance thresholds
    avg_response_time = stats.total.avg_response_time
    failure_rate = stats.total.num_failures / max(stats.total.num_requests, 1)
    
    print("\n=== Performance Analysis ===")
    
    if avg_response_time > 2000:
        print(f"❌ Average response time too high: {avg_response_time:.2f}ms (threshold: 2000ms)")
    else:
        print(f"✅ Average response time OK: {avg_response_time:.2f}ms")
    
    if failure_rate > 0.05:  # 5% failure rate threshold
        print(f"❌ Failure rate too high: {failure_rate:.2%} (threshold: 5%)")
    else:
        print(f"✅ Failure rate OK: {failure_rate:.2%}")
    
    # Performance recommendations
    if avg_response_time > 1000:
        print("\n💡 Recommendations:")
        if avg_response_time > 3000:
            print("- Consider database query optimization")
            print("- Review API endpoint performance")
            print("- Check server resource utilization")
        print("- Implement caching for frequent requests")
        print("- Consider CDN for static assets")


# Custom task set for specific scenarios
class FileUploadScenario(HttpUser):
    """Escenario específico para testing de uploads"""
    
    wait_time = between(3, 7)
    
    def on_start(self):
        self.login()
        self.project_id = self.create_project()
    
    def login(self):
        response = self.client.post("/api/v1/auth/login", json={
            "username": "uploaduser@example.com",
            "password": "testpassword123"
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.client.headers.update({"Authorization": f"Bearer {token}"})
    
    def create_project(self):
        response = self.client.post("/api/v1/projects/", json={
            "name": f"Upload Test Project {random.randint(1, 1000)}",
            "description": "For upload testing"
        })
        return response.json()["id"] if response.status_code == 201 else 1
    
    @task
    def upload_and_translate_workflow(self):
        """Flujo completo: upload → traducción → verificación"""
        # Upload file
        file_content = b"Test CAD content " * 500  # ~8KB
        files = {"file": ("test.rvt", BytesIO(file_content), "application/octet-stream")}
        data = {"project_id": str(self.project_id)}
        
        upload_response = self.client.post("/api/v1/files/upload", files=files, data=data)
        
        if upload_response.status_code == 201:
            file_id = upload_response.json()["id"]
            
            # Start translation
            translation_response = self.client.post("/api/v1/translate/", json={
                "file_id": file_id,
                "output_formats": ["svf2"],
                "priority": "normal"
            })
            
            if translation_response.status_code == 201:
                job_id = translation_response.json()["id"]
                
                # Check status a few times
                for _ in range(3):
                    time.sleep(1)
                    self.client.get(f"/api/v1/translate/{job_id}/status")


if __name__ == "__main__":
    # This allows running the locustfile directly for testing
    import subprocess
    import sys
    
    # Run with basic configuration
    cmd = [
        sys.executable, "-m", "locust",
        "-f", __file__,
        "--host", "http://localhost:8000",
        "--users", "10",
        "--spawn-rate", "2",
        "--run-time", "60s",
        "--html", "reports/load-test-report.html"
    ]
    
    subprocess.run(cmd)
