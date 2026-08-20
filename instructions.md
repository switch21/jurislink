JURISLINK V2 — PLAN DE ROUTE D'IMPLÉMENTATION POUR AGENT IA
0. Règles impératives à donner à l'agent

Copier ce bloc au début du prompt de l'agent :

Tu travailles sur le dépôt GitHub switch21/jurislink.

Objectif : transformer la version actuelle en JurisLink V2 robuste, sécurisée, maintenable, moderne et prête pour une évolution SaaS multi-tenant.

Stack existante à préserver :

React + Vite
TypeScript
Vanilla CSS
Zustand
Supabase
PostgreSQL
Supabase Auth
Supabase Storage
Supabase Realtime
React Native / Expo pour le mobile

Contraintes absolues :

Ne pas supprimer .env ou modifier sa stratégie actuelle.
Ne pas implémenter le cœur fonctionnel de l'IA pour l'instant.
Ne pas supprimer les données de démonstration existantes sans instruction explicite.
Ne pas réécrire massivement l'application si une correction ciblée suffit.
Ne pas désactiver ESLint ou TypeScript pour faire disparaître les erreurs.
Ne pas utiliser any sauf justification exceptionnelle.
Ne jamais contourner Supabase RLS côté frontend.
Ne jamais considérer le frontend comme une frontière de sécurité.
Préserver les fonctionnalités existantes.
Après chaque lot, exécuter les tests et validations correspondants.
Ne jamais annoncer une tâche comme terminée sans preuve de validation.
Avant toute modification importante, inspecter le code existant et comprendre son fonctionnement.
Faire des commits atomiques.
Ne pas modifier plusieurs domaines fonctionnels dans un même commit lorsque cela peut être évité.
PHASE 0 — BASELINE ET PROTECTION DU PROJET
Tâche 0.1 — Créer une branche V2
git checkout feature/jurislink-v2-foundation
git pull origin feature/jurislink-v2-foundation

Vérifier :

git status
git branch --show-current
Critère d'acceptation

La branche de travail est propre et synchronisée avec son remote.

Tâche 0.2 — Identifier l'architecture

Créer :

docs/
└── architecture/
    └── current-state.md

Documenter :

structure src/
composants
pages
stores
services
Supabase
Edge Functions
routes
authentification
gestion des rôles
multi-tenancy
Storage
Realtime
i18n
mobile
configuration Vite
configuration TypeScript
configuration ESLint

Ne rien modifier pendant cette tâche.

Tâche 0.3 — Établir le baseline

Exécuter :

npm install
npm run typecheck
npm run lint
npm run build

Enregistrer les résultats dans :

docs/quality/baseline.md
Critère

Le document doit contenir :

TypeScript : X erreurs
ESLint : X erreurs / X warnings
Build : OK/KO
Tests : OK/KO
PHASE 1 — QUALITÉ DU CODE
Tâche 1.1 — Corriger ESLint

Avant toute correction métier, faire démarrer ESLint correctement.

Vérifier :

eslint.config.js

Les répertoires générés doivent être exclus :

dist
android
node_modules
coverage
.expo

Ne pas désactiver les règles React Hooks.

Validation
npm run lint
PHASE 2 — AUTHENTIFICATION ET SÉCURITÉ

Priorité maximale.

Tâche 2.1 — Auditer authStore.ts

Inspecter :

src/store/authStore.ts

Vérifier :

récupération session
refresh session
onAuthStateChange
unsubscribe
profil
tenant
rôle
is_active
MFA
logout
gestion des erreurs
concurrence lors de l'initialisation
Objectif

Il ne doit jamais être possible d'avoir :

session utilisateur valide
+
profil invalide/inexistant
+
accès à l'application
Tâche 2.2 — MFA

Auditer :

src/components/auth/MfaSetup.tsx

Implémenter proprement :

enrollment
     ↓
QR Code
     ↓
scan Google Authenticator/Authy
     ↓
challenge
     ↓
verification
     ↓
activation
     ↓
redirection
Règles
ne jamais considérer MFA comme activé avant verify
supprimer les facteurs TOTP non vérifiés abandonnés
empêcher plusieurs facteurs temporaires
ne jamais afficher le secret TOTP
ne jamais logger le code MFA
gérer les erreurs Supabase proprement
supprimer les any
Critères

Tester :

nouvel utilisateur
QR invalide
mauvais code
bon code
double tentative
refresh navigateur
logout/login
Tâche 2.3 — MFA côté serveur

Inspecter :

supabase/functions/verify-session/

Le serveur doit déterminer :

user
tenant
role
is_active
MFA/AAL

Le frontend ne doit jamais être l'autorité finale.

Flux :

Browser
   ↓
Supabase Auth
   ↓
verify-session
   ↓
profil + tenant + rôle + AAL
   ↓
autorisation
Tâche 2.4 — ProtectedRoute

Auditer :

ProtectedRoute.tsx

Créer une matrice claire :

État	Accès
non authentifié	login
authentifié sans profil	refus
MFA requis	MFA
tenant désactivé	refus
utilisateur désactivé	refus
rôle insuffisant	forbidden
OK	application
PHASE 3 — MULTI-TENANT / AUTORISATION
Tâche 3.1 — Cartographier les rôles

Documenter :

root_admin
firm_admin
lawyer
secretary
client

Pour chaque rôle :

pages accessibles
opérations autorisées
données accessibles
données modifiables
données supprimables

Créer :

docs/security/authorization-matrix.md
Tâche 3.2 — Audit RLS Supabase

Inspecter toutes les tables.

Pour chaque table :

SELECT
INSERT
UPDATE
DELETE

doit être analysé.

Particulièrement :

profiles
tenants
clients
cases
documents
notes
events
invoices
messages
notifications
audit_logs
Règle fondamentale

Un utilisateur du tenant A ne doit jamais pouvoir lire ou modifier les données du tenant B, même en appelant directement Supabase.

Tâche 3.3 — Tests d'isolation

Créer des tests permettant de vérifier :

Tenant A → Tenant A = autorisé
Tenant A → Tenant B = refusé

Tester également les rôles.

PHASE 4 — SESSION ET TIMEOUT
Tâche 4.1 — ActivityTracker

Auditer :

src/components/common/ActivityTracker.tsx

Objectif :

activité utilisateur
       ↓
reset timeout
       ↓
warning
       ↓
logout automatique

Éviter :

timers multiples
closures obsolètes
effets qui se réabonnent inutilement
setState dangereux
memory leaks

Utiliser :

ReturnType<typeof setTimeout>

pour les timers navigateur.

Tâche 4.2 — SessionTimeout

Auditer :

SessionTimeout.tsx

Éviter d'avoir deux mécanismes contradictoires.

Décider explicitement :

ActivityTracker = activité utilisateur
SessionTimeout = expiration session

ou fusionner les deux.

Ne pas conserver deux systèmes redondants.

PHASE 5 — CLEAN CODE
Tâche 5.1 — Supprimer les imports inutilisés

Corriger tous les :

React inutilisé
X inutilisé
Filter inutilisé
Search inutilisé
useTranslation inutilisé
Tâche 5.2 — Supprimer les any

Rechercher :

grep -R "any" src

ou équivalent Windows.

Remplacer par :

unknown
type guard lorsque nécessaire.
PHASE 6 — REFACTORISATION REACT

Corriger progressivement :

setState() dans useEffect

sans simplement désactiver :

react-hooks/set-state-in-effect

Pour chaque occurrence :

comprendre pourquoi le state est dérivé ;
déterminer s'il peut être calculé directement ;
utiliser useMemo si nécessaire ;
déplacer la logique dans l'action utilisateur si approprié ;
conserver useEffect uniquement pour les vrais effets externes.
PHASE 7 — MODALS

Refactoriser :

TenantModal
UserModal
ClientModal
DocumentModal
EventModal
InvoiceModal

Créer éventuellement des primitives réutilisables :

Modal
FormField
FormError
FormActions
ConfirmDialog

Objectif :

validation
loading
success
error
cancel
keyboard
accessibility
PHASE 8 — CLIENTS

Améliorer :

ClientsList

Fonctionnalités :

recherche
filtres
pagination
tri
statut
avocat responsable
nombre de dossiers
dernière activité
accès rapide au dossier

UI :

Client
Nom
Contact
Dossiers
Statut
Dernière activité
Actions
PHASE 9 — DOSSIERS JURIDIQUES

Refondre progressivement :

CasesList

Chaque dossier doit afficher :

Référence
Client
Type
Avocat responsable
Statut
Priorité
Prochaine échéance
Confidentialité
Dernière activité

Prévoir les statuts :

Nouveau
Ouvert
En cours
En attente
Clos
Archivé
PHASE 10 — DOCUMENTS

Créer une architecture documentaire plus robuste.

Fonctions :

upload
prévisualisation
téléchargement
suppression
version
type
taille
auteur
date
dossier associé

Ajouter :

document_versions

si l'architecture actuelle ne le permet pas correctement.

PHASE 11 — AUDIT LOG

Renforcer :

AuditLogs
EventHistory

Chaque événement sensible doit pouvoir enregistrer :

actor_id
tenant_id
action
resource_type
resource_id
timestamp
IP si architecture autorisée
user_agent si architecture autorisée
metadata

Exemples :

LOGIN
LOGOUT
MFA_ENABLED
MFA_FAILED
CLIENT_CREATED
CASE_CREATED
DOCUMENT_DOWNLOADED
DOCUMENT_DELETED
USER_CREATED
ROLE_CHANGED
TENANT_UPDATED
PHASE 12 — NOTIFICATIONS

Refondre NotificationBell.

Prévoir :

non lu
lu
tout marquer comme lu
catégorie
date
lien vers ressource

Catégories :

dossier
échéance
document
facture
message
sécurité
PHASE 13 — DASHBOARD V2

Le dashboard doit devenir un véritable centre de pilotage.

Bloc 1
Dossiers actifs
Clients
Échéances
Factures impayées
Bloc 2
Dossiers par statut
Bloc 3
Échéances prochaines
Bloc 4
Activité récente
Bloc 5
Alertes

Pour root_admin :

tenants actifs
utilisateurs
activité globale
santé plateforme
PHASE 14 — UI/UX JURISLINK V2
Nouvelle direction visuelle

Adopter une interface :

Premium
Professionnelle
Juridique
Sobre
Rapide
Très lisible
Responsive
Navigation desktop
┌─────────────────────────────────────┐
│ Logo       Recherche      Profil    │
├────────────┬────────────────────────┤
│ Dashboard  │                        │
│ Dossiers   │       CONTENU          │
│ Clients    │                        │
│ Documents  │                        │
│ Calendrier │                        │
│ Factures   │                        │
│ Messages   │                        │
│ Rapports   │                        │
│            │                        │
│ Paramètres │                        │
└────────────┴────────────────────────┘
PHASE 15 — DESIGN SYSTEM

Créer :

src/components/ui/

avec :

Button
Input
Select
Textarea
Modal
Dropdown
Badge
Card
Table
Tabs
Tooltip
Toast
Skeleton
EmptyState
ConfirmDialog
Avatar

Créer des tokens CSS :

--color-primary
--color-secondary
--color-danger
--color-warning
--color-success


--radius-sm
--radius-md
--radius-lg


--shadow-sm
--shadow-md
--shadow-lg


--spacing-xs
--spacing-sm
--spacing-md
--spacing-lg
PHASE 16 — RESPONSIVE

Tester au minimum :

320px
375px
390px
768px
1024px
1280px
1440px
1920px

Priorité mobile :

login
dashboard
clients
dossiers
documents
notifications
profil
PHASE 17 — ACCESSIBILITÉ

Chaque interface doit respecter :

navigation clavier
focus visible
labels
aria-label
contraste
boutons accessibles
modals accessibles
images avec alt
erreurs de formulaire accessibles
PHASE 18 — PERFORMANCE

Auditer :

bundle
lazy loading
images
Supabase queries
Realtime subscriptions
renders

Mettre en place :

React.lazy
Suspense
pagination
debounce recherche
memoization seulement si nécessaire

Éviter les optimisations prématurées.

PHASE 19 — SUPABASE

Auditer :

queries
indexes
RLS
RPC
Edge Functions
Storage policies
Realtime policies

Identifier les requêtes N+1.

Ajouter les index nécessaires.

PHASE 20 — STORAGE

Vérifier que les documents juridiques ne sont jamais accessibles publiquement.

Préférer :

private bucket
       ↓
authorization
       ↓
signed URL courte durée

Vérifier également les noms de fichiers et chemins.

PHASE 21 — EDGE FUNCTIONS

Auditer :

verify-session
rate-limit
create-user

Pour chacune :

authentication
authorization
input validation
error handling
rate limiting
logging
CORS
secrets

Ne jamais faire confiance à :

user_id
tenant_id
role

envoyés par le frontend.

Les dériver du contexte authentifié.

PHASE 22 — VALIDATION DES DONNÉES

Introduire une validation cohérente côté serveur.

Par exemple avec une bibliothèque de validation déjà présente ou approuvée dans le projet.

Valider :

email
phone
UUID
dates
montants
IDs
rôles
statuts
pagination
filtres
PHASE 23 — RATE LIMITING

Protéger :

login
MFA
reset password
create user
upload
messages
API sensibles

Ne pas se limiter au frontend.

PHASE 24 — GESTION DES ERREURS

Créer une stratégie uniforme :

Erreur réseau
Erreur Auth
Erreur permission
Erreur validation
Erreur serveur
Erreur inattendue

UX :

message compréhensible utilisateur
+
détail technique uniquement dans logs
PHASE 25 — TESTS

Créer progressivement :

tests/
├── auth/
├── security/
├── clients/
├── cases/
├── documents/
├── invoices/
└── ui/

Tests prioritaires :

Auth
login
logout
MFA
session
expiration
Sécurité
tenant isolation
role isolation
RLS
Storage
Métier
create client
create case
upload document
archive case
invoice
PHASE 26 — TESTS E2E

Scénario principal :

Login
 ↓
MFA
 ↓
Dashboard
 ↓
Créer client
 ↓
Créer dossier
 ↓
Ajouter document
 ↓
Créer événement
 ↓
Voir notification
 ↓
Logout
PHASE 27 — MOBILE

Ne pas refaire immédiatement l'application Expo.

Après stabilisation du Web :

identifier les services partagés ;
vérifier Auth ;
vérifier MFA ;
vérifier API ;
vérifier modèles ;
adapter UI mobile.

Objectif :

Web
Mobile
     ↓
même backend
mêmes règles d'autorisation
mêmes données
PHASE 28 — IA — UNIQUEMENT PRÉPARATION

Ne pas implémenter le cœur IA.

Préparer seulement les interfaces :

src/services/ai/

par exemple :

aiService.ts
ai.types.ts
ai.errors.ts

Définir les contrats futurs :

summarizeCase()
analyzeDocument()
generateLegalDraft()
searchKnowledge()

Mais laisser les implémentations en attente.

PHASE 29 — OBSERVABILITÉ

Préparer :

logs
errors
performance
security events

Séparer :

audit logs
application logs
security logs
PHASE 30 — BUILD FINAL

L'agent doit terminer par :

npm run typecheck
npm run lint
npm run build

Puis, si disponibles :

npm test
npm run test:e2e
PHASE 31 — REVUE DE SÉCURITÉ FINALE

Créer :

docs/security/final-security-audit.md

Vérifier au minimum :

Auth
 MFA
 session
 logout
 password reset
 account disable
Authorization
 RBAC
 tenant isolation
 RLS
 Storage policies
 Edge Functions
Data
 données sensibles
 logs
 documents
 URLs signées
 exposition frontend
API
 validation
 rate limiting
 erreurs
 CORS
 secrets
PHASE 32 — GATE FINAL

L'agent ne doit pas déclarer V2 terminée tant que :

☐ npm run typecheck = 0 erreur
☐ npm run lint = 0 erreur
☐ npm run build = succès
☐ tests = succès
☐ RLS audité
☐ Storage audité
☐ MFA testé
☐ RBAC testé
☐ isolation tenant testée
☐ Edge Functions auditées
☐ UI responsive
☐ accessibilité vérifiée
☐ documentation mise à jour
Ordre d'exécution recommandé

Pour éviter qu'un agent parte dans tous les sens, je lui imposerais cet ordre exact :

01. Baseline
      ↓
02. ESLint
      ↓
03. TypeScript
      ↓
04. AuthStore
      ↓
05. MFA
      ↓
06. ProtectedRoute
      ↓
07. Session / Timeout
      ↓
08. RBAC
      ↓
09. RLS / Multi-tenant
      ↓
10. Storage
      ↓
11. Edge Functions
      ↓
12. Clean Code
      ↓
13. React Hooks
      ↓
14. Composants UI
      ↓
15. Clients
      ↓
16. Dossiers
      ↓
17. Documents
      ↓
18. Facturation
      ↓
19. Notifications
      ↓
20. Dashboard V2
      ↓
21. Design System
      ↓
22. UI/UX V2
      ↓
23. Responsive
      ↓
24. Accessibilité
      ↓
25. Performance
      ↓
26. Tests unitaires
      ↓
27. Tests E2E
      ↓
28. Mobile
      ↓
29. Préparation IA
      ↓
30. Audit sécurité final
      ↓
31. Build production
      ↓
32. Rapport final
Règle très importante pour l'agent

À chaque phase, il doit produire :

1. Fichiers modifiés
2. Changements réalisés
3. Problèmes rencontrés
4. Commandes exécutées
5. Résultats
6. Risques éventuels
7. Commit créé

Et surtout : ne pas passer à la phase suivante si la phase précédente introduit des erreurs de typecheck, lint ou build.