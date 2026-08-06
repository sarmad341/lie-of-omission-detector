"""
FastAPI entrypoint.

Run with:
    uvicorn main:app --reload

Assumes core/, models/, pipeline/ folders are importable from this location.
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from api import cases, dashboard, health, companies, claim_generator, applications, admin

app = FastAPI(
    title="Multimodal Lie-of-Omission Detector API",
    version="2.0",
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"422 Validation Error on {request.url}")
    print(exc.errors())
    print(exc.body)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

# Wide-open CORS for local dev. Tighten before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(cases.router, prefix="/cases", tags=["cases"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(companies.router, prefix="/companies", tags=["companies"])
app.include_router(claim_generator.router, prefix="/claim-generator", tags=["claim-generator"])
app.include_router(applications.router, prefix="/applications", tags=["applications"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])

app.mount("/uploaded_cases", StaticFiles(directory="uploaded_cases"), name="uploaded_cases")





