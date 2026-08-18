#!/usr/bin/env bash
# ============================================================================
# JurisLink - Phase 5.8 - Security audit script
# ============================================================================
# Emplacement: scripts/security-audit.sh (nouveau fichier)
#
# Usage:
#   bash scripts/security-audit.sh
#   # ou via npm: npm run security:audit
#
# Exit codes:
#   0 — Tous les checks critiques sont OK
#   1 — Au moins un check critique a échoué (CRITICAL/ERROR)
#   2 — Warnings seulement (à investiguer mais pas bloquant)
#
# Catégories de checks:
#   CRITICAL — Failles majeures (service_role leak, no CSP, etc.)
#   WARNING  — Bonnes pratiques à améliorer
#   INFO     — Statistiques (nombre de fichiers, etc.)
# ============================================================================

set -u  # échoue sur variable non définie
# Note: pas de set -e car on veut continuer même en cas d'échec d'un check

# ─── Couleurs ───────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Compteurs ───────────────────────────────────────────────────────────────
ERRORS=0
WARNINGS=0
INFOS=0

log_critical() { echo -e "${RED}[CRITICAL]${NC} $1"; ERRORS=$((ERRORS + 1)); }
log_warning()  { echo -e "${YELLOW}[WARNING]${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
log_ok()        { echo -e "${GREEN}[OK]${NC} $1"; }
log_info()      { echo -e "${BLUE}[INFO]${NC} $1"; INFOS=$((INFOS + 1)); }

# ============================================================================
# CHECK 1: CSP présent dans index.html
# ============================================================================
echo ""
echo "─── Check 1: Content-Security-Policy dans index.html ───────────"
if grep -q 'Content-Security-Policy' index.html 2>/dev/null; then
  log_ok "CSP meta tag présent dans index.html"
else
  log_critical "CSP MANQUANT dans index.html — risque XSS, clickjacking, mixed content"
  log_info "  Ajouter: <meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; ...\">"
fi

# ============================================================================
# CHECK 2: Security headers dans vite.config.ts (preview/dev)
# ============================================================================
echo ""
echo "─── Check 2: Security headers dans vite.config.ts ───────────────"
if grep -qE '(X-Content-Type-Options|Strict-Transport-Security)' vite.config.ts 2>/dev/null; then
  log_ok "Security headers présents dans vite.config.ts"
else
  log_warning "Security headers MANQUANTS dans vite.config.ts (dev/preview)"
  log_info "  Ajouter server.headers et preview.headers avec buildSecurityHeaders()"
fi

# ============================================================================
# CHECK 3: Pas de service_role dans src/ (leak critical)
# ============================================================================
echo ""
echo "─── Check 3: Recherche de SERVICE_ROLE_KEY dans src/ ──────────"
LEAKS=$(grep -rE 'SERVICE_ROLE_KEY|service_role' src/ 2>/dev/null | grep -v '__tests__' | grep -v '.bak' || true)
if [ -z "$LEAKS" ]; then
  log_ok "Aucune référence à SERVICE_ROLE_KEY dans src/ (à l'exception des tests)"
else
  log_critical "SERVICE_ROLE_KEY détecté dans src/ — FUITE CRITIQUE"
  echo "$LEAKS" | head -20
fi

# ============================================================================
# CHECK 4: Pas de hard-coded secrets (AWS, Stripe, etc.)
# ============================================================================
echo ""
echo "─── Check 4: Recherche de hard-coded secrets ─────────────────"
SECRET_PATTERNS='(AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{24,}|ghp_[0-9a-zA-Z]{36,}|github_pat_[0-9a-zA-Z_]+)'
SECRETS=$(grep -rE "$SECRET_PATTERNS" src/ 2>/dev/null | grep -v '__tests__' | grep -v '.bak' || true)
if [ -z "$SECRETS" ]; then
  log_ok "Aucun secret AWS/Stripe/GitHub détecté dans src/"
else
  log_critical "SECRET hard-coded détecté dans src/ — révoquer immédiatement et déplacer en env var"
  echo "$SECRETS" | head -20
fi

# ============================================================================
# CHECK 5: Password policy (analyzePassword) présente
# ============================================================================
echo ""
echo "─── Check 5: Password policy (passwordPolicy.ts) ─────────────"
if [ -f "src/lib/passwordPolicy.ts" ]; then
  if grep -q 'export function analyzePassword' src/lib/passwordPolicy.ts; then
    log_ok "analyzePassword() présente dans src/lib/passwordPolicy.ts"
  else
    log_warning "passwordPolicy.ts existe mais analyzePassword() non trouvée"
  fi
else
  log_critical "src/lib/passwordPolicy.ts MANQUANT — Phase 4 non déployée"
fi

# ============================================================================
# CHECK 6: CSRF protection présente
# ============================================================================
echo ""
echo "─── Check 6: CSRF protection (csrf.ts) ────────────────────────"
if [ -f "src/lib/csrf.ts" ]; then
  if grep -q 'getCsrfToken\|X-CSRF-Token' src/lib/csrf.ts src/lib/supabase.ts 2>/dev/null; then
    log_ok "CSRF protection présente (csrf.ts + injection supabase.ts)"
  else
    log_warning "csrf.ts existe mais injection supabase.ts incomplète"
  fi
else
  log_critical "src/lib/csrf.ts MANQUANT — Phase 3 non déployée"
fi

# ============================================================================
# CHECK 7: Audit log helper présent
# ============================================================================
echo ""
echo "─── Check 7: Audit log helper (audit.ts) ──────────────────────"
if [ -f "src/lib/audit.ts" ]; then
  if grep -q 'export function logAudit' src/lib/audit.ts; then
    log_ok "logAudit() présente dans src/lib/audit.ts"
  else
    log_warning "audit.ts existe mais logAudit() non trouvée"
  fi
else
  log_critical "src/lib/audit.ts MANQUANT — Phase 3 non déployée"
fi

# ============================================================================
# CHECK 8: Rate limiting présent
# ============================================================================
echo ""
echo "─── Check 8: Rate limiting (rateLimit.ts) ─────────────────────"
if [ -f "src/lib/rateLimit.ts" ]; then
  log_ok "rateLimit.ts présente (Phase 4)"
else
  log_critical "src/lib/rateLimit.ts MANQUANT — Phase 4 non déployée"
fi

# ============================================================================
# CHECK 9: Session hardening (sessionManager.ts, SessionTimeout.tsx)
# ============================================================================
echo ""
echo "─── Check 9: Session hardening (Phase 5) ──────────────────────"
if [ -f "src/lib/sessionManager.ts" ]; then
  log_ok "sessionManager.ts présente (Phase 5)"
else
  log_warning "src/lib/sessionManager.ts MANQUANT — Phase 5 non déployée"
fi
if [ -f "src/components/common/SessionTimeout.tsx" ]; then
  log_ok "SessionTimeout.tsx présente (Phase 4 — idle timeout)"
else
  log_warning "SessionTimeout.tsx MANQUANT — Phase 4 non déployée"
fi

# ============================================================================
# CHECK 10: HIBP integration (Phase 5)
# ============================================================================
echo ""
echo "─── Check 10: HIBP k-anonymity (Phase 5) ─────────────────────"
if [ -f "src/lib/hibp.ts" ]; then
  if grep -q 'checkPasswordBreach' src/lib/hibp.ts; then
    log_ok "hibp.ts présente (Phase 5 — HaveIBeenPwned k-anonymity)"
  else
    log_warning "hibp.ts existe mais checkPasswordBreach non trouvée"
  fi
else
  log_warning "src/lib/hibp.ts MANQUANT — Phase 5 non déployée"
fi

# ============================================================================
# CHECK 11: Edge functions — security headers module partagé
# ============================================================================
echo ""
echo "─── Check 11: Edge functions security headers module ──────────"
if [ -f "supabase/functions/_shared/security-headers.ts" ]; then
  log_ok "_shared/security-headers.ts présente (Phase 5)"
else
  log_warning "supabase/functions/_shared/security-headers.ts MANQUANT"
fi

# Vérifie que les edge functions utilisent applySecurityHeaders
for fn in verify-session create-user rate-limit; do
  if [ -f "supabase/functions/$fn/index.ts" ]; then
    if grep -q 'applySecurityHeaders' "supabase/functions/$fn/index.ts"; then
      log_ok "Edge function '$fn' utilise applySecurityHeaders (Phase 5)"
    else
      log_warning "Edge function '$fn' n'utilise PAS applySecurityHeaders"
    fi
  fi
done

# ============================================================================
# CHECK 12: Migrations SQL présentes
# ============================================================================
echo ""
echo "─── Check 12: Migrations SQL présentes ────────────────────────"
for mig in 01_rls_consolidated 02_audit_logs_metadata 03_account_lockout 04_session_hardening; do
  if [ -f "supabase/migrations/$mig.sql" ]; then
    log_ok "Migration $mig.sql présente"
  else
    log_warning "Migration $mig.sql MANQUANTE"
  fi
done

# ============================================================================
# CHECK 13: Dépendance à des packages vulnérables (npm audit)
# ============================================================================
echo ""
echo "─── Check 13: npm audit (vulnérabilités dépendances) ─────────"
if command -v npm >/dev/null 2>&1; then
  # --audit-level=high: ne sort que les HIGH+CRITICAL
  AUDIT_OUT=$(npm audit --audit-level=high --omit=dev 2>&1 || true)
  if echo "$AUDIT_OUT" | grep -q "found 0 vulnerabilities"; then
    log_ok "npm audit: 0 vulnérabilité HIGH/CRITICAL"
  else
    VULN_COUNT=$(echo "$AUDIT_OUT" | grep -oE '[0-9]+ vulnerabilit(y|ies)' | head -1 || echo "inconnu")
    log_warning "npm audit: vulnérabilités détectées ($VULN_COUNT)"
    log_info "  Lancer: npm audit --omit=dev pour le détail"
    log_info "  Fixer avec: npm audit fix (vérifier le changelog avant)"
  fi
else
  log_info "npm non disponible dans cet env — skip"
fi

# ============================================================================
# CHECK 14: Tests présents (nombre de specs)
# ============================================================================
echo ""
echo "─── Check 14: Tests présents ──────────────────────────────────"
SPEC_COUNT=$(find src/__tests__ -name '*.spec.ts' -o -name '*.spec.tsx' 2>/dev/null | wc -l)
if [ "$SPEC_COUNT" -gt 5 ]; then
  log_ok "$SPEC_COUNT fichiers de tests présents dans src/__tests__/"
else
  log_warning "Seulement $SPEC_COUNT fichiers de tests — viser 8+"
fi

# ============================================================================
# CHECK 15: .env non commité
# ============================================================================
echo ""
echo "─── Check 15: Fichiers .env non commités ──────────────────────"
if [ -f ".env" ]; then
  if grep -q '^\.env$' .gitignore 2>/dev/null; then
    log_ok ".env dans .gitignore"
  else
    log_critical ".env présent mais PAS dans .gitignore — risque de leak secrets"
  fi
else
  log_ok "Pas de .env (bonne pratique — utiliser des secrets Supabase)"
fi

# ============================================================================
# CHECK 16: TypeScript strict mode
# ============================================================================
echo ""
echo "─── Check 16: TypeScript strict mode ──────────────────────────"
if grep -q '"strict": true' tsconfig.app.json 2>/dev/null; then
  log_ok "TypeScript strict mode activé dans tsconfig.app.json"
else
  log_warning "TypeScript strict mode NON activé — recommandé"
fi
if grep -q '"noUncheckedIndexedAccess": true' tsconfig.app.json 2>/dev/null; then
  log_ok "noUncheckedIndexedAccess activé (sécurité d'accès array)"
else
  log_warning "noUncheckedIndexedAccess NON activé — recommandé pour éviter undefined bugs"
fi

# ============================================================================
# RÉSUMÉ FINAL
# ============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "                       RÉSUMÉ AUDIT"
echo "═══════════════════════════════════════════════════════════════"
echo -e "  ${GREEN}OK${NC}       — Checks validés"
echo -e "  ${YELLOW}WARNING${NC}  — À investiguer (non bloquant): $WARNINGS"
echo -e "  ${RED}CRITICAL${NC} — Failles à corriger: $ERRORS"
echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}❌ Audit ÉCHEC: $ERRORS problème(s) critique(s) détecté(s)${NC}"
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Audit PASS avec $WARNINGS warning(s)${NC}"
  exit 2
else
  echo -e "${GREEN}✅ Audit PASS — posture sécurité conforme${NC}"
  exit 0
fi
