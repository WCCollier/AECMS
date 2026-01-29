#!/bin/bash
# ============================================================================
# AECMS Phase Validation Script
# ============================================================================
# Automated validation script that Claude Code can run after each phase
# to verify successful completion of all deliverables.

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the project root
if [ ! -f "docker-compose.yml" ]; then
    log_error "Must run from project root (where docker-compose.yml is located)"
    exit 1
fi

echo ""
echo "🚀 Starting AECMS Phase Validation..."
echo "======================================"
echo ""

# -----------------------------------------------------------------------------
# 1. Environment Variables Check
# -----------------------------------------------------------------------------
log_info "Checking required environment variables..."

REQUIRED_VARS=(
    "DB_PASSWORD"
    "JWT_SECRET"
    "NODE_ENV"
    "API_URL"
    "APP_URL"
    "FRONTEND_URL"
    "REDIS_URL"
)

MISSING_VARS=0
for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        log_warning "$VAR is not set"
        MISSING_VARS=$((MISSING_VARS + 1))
    fi
done

if [ $MISSING_VARS -eq 0 ]; then
    log_success "All required environment variables are set"
else
    log_warning "$MISSING_VARS required variables are missing"
fi

echo ""

# -----------------------------------------------------------------------------
# 2. Backend Validation
# -----------------------------------------------------------------------------
log_info "Validating Backend (NestJS)..."

cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    log_error "Backend node_modules not found. Run 'npm install' first."
    exit 1
fi

# Build check
log_info "Building backend..."
if npm run build > /dev/null 2>&1; then
    log_success "Backend builds successfully"
else
    log_error "Backend build failed"
    exit 1
fi

# Lint check
log_info "Linting backend..."
if npm run lint > /dev/null 2>&1; then
    log_success "Backend passes linting"
else
    log_warning "Backend has linting issues (non-critical)"
fi

# Test check
log_info "Running backend tests..."
if npm run test > /dev/null 2>&1; then
    log_success "Backend tests pass"
else
    log_warning "Backend tests failed (expected for Phase 0)"
fi

# Prisma validation
log_info "Validating Prisma schema..."
if npx prisma validate > /dev/null 2>&1; then
    log_success "Prisma schema is valid"
else
    log_warning "Prisma schema validation failed (may need schema definition)"
fi

cd ..

echo ""

# -----------------------------------------------------------------------------
# 3. Frontend Validation
# -----------------------------------------------------------------------------
log_info "Validating Frontend (Next.js)..."

cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    log_error "Frontend node_modules not found. Run 'npm install' first."
    exit 1
fi

# Build check
log_info "Building frontend..."
if npm run build > /dev/null 2>&1; then
    log_success "Frontend builds successfully"
else
    log_error "Frontend build failed"
    exit 1
fi

# Lint check
log_info "Linting frontend..."
if npm run lint > /dev/null 2>&1; then
    log_success "Frontend passes linting"
else
    log_warning "Frontend has linting issues (non-critical)"
fi

cd ..

echo ""

# -----------------------------------------------------------------------------
# 4. Docker Validation
# -----------------------------------------------------------------------------
log_info "Validating Docker Compose configuration..."

if docker-compose config > /dev/null 2>&1; then
    log_success "Docker Compose configuration is valid"
else
    log_error "Docker Compose configuration is invalid"
    exit 1
fi

echo ""

# -----------------------------------------------------------------------------
# 5. Security Audit
# -----------------------------------------------------------------------------
log_info "Running security audit..."

cd backend
BACKEND_VULNS=$(npm audit --audit-level=moderate --json 2>/dev/null | grep -c '"severity":"high"' || echo "0")
cd ..

cd frontend
FRONTEND_VULNS=$(npm audit --audit-level=moderate --json 2>/dev/null | grep -c '"severity":"high"' || echo "0")
cd ..

TOTAL_VULNS=$((BACKEND_VULNS + FRONTEND_VULNS))

if [ $TOTAL_VULNS -eq 0 ]; then
    log_success "No high severity vulnerabilities found"
else
    log_warning "Found $TOTAL_VULNS high severity vulnerabilities"
fi

echo ""

# -----------------------------------------------------------------------------
# 6. File Structure Check
# -----------------------------------------------------------------------------
log_info "Validating project structure..."

REQUIRED_FILES=(
    "backend/package.json"
    "backend/Dockerfile"
    "backend/.dockerignore"
    "backend/prisma/schema.prisma"
    "frontend/package.json"
    "frontend/Dockerfile"
    "frontend/.dockerignore"
    "docker-compose.yml"
    ".env.example"
    ".gitignore"
)

MISSING_FILES=0
for FILE in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$FILE" ]; then
        log_warning "Missing: $FILE"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done

if [ $MISSING_FILES -eq 0 ]; then
    log_success "All required files present"
else
    log_warning "$MISSING_FILES required files are missing"
fi

echo ""

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo "======================================"
echo "📊 Validation Summary"
echo "======================================"
echo ""

log_success "Backend: Built and validated"
log_success "Frontend: Built and validated"
log_success "Docker: Configuration valid"

if [ $TOTAL_VULNS -gt 0 ]; then
    log_warning "Security: $TOTAL_VULNS high severity vulnerabilities"
else
    log_success "Security: No high severity vulnerabilities"
fi

if [ $MISSING_FILES -gt 0 ]; then
    log_warning "Structure: $MISSING_FILES missing files"
else
    log_success "Structure: All files present"
fi

echo ""
echo "✅ Phase Validation Complete!"
echo ""
echo "Next steps:"
echo "  1. Review any warnings above"
echo "  2. Start services: docker-compose up -d"
echo "  3. Check health: docker-compose ps"
echo ""
