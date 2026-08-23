# ============================================================================
# VdoGen — Makefile
#
# Targets are grouped by concern:
#   run/*   -> run BE/FE locally (no Docker, no cluster)
#   build/* -> build Docker images locally
#   push/*  -> build + push images to the registry
#   local/* -> local stack: cluster init + docker compose up/down
#   deploy/*-> push backend images + rollout refresh, or deploy FE to Cloudflare
#   k8s/*   -> kubectl helpers against the prod (OCI Oracle) cluster
#   misc     -> install, logs, prune
#
# Local model: master/worker/status + Postgres + Redis run in docker compose;
# minikube executes only the k8s render Jobs (no deploy to cluster).
#
# Overridable variables:
#   VERSION   image tag to build/push/use      (default: latest)
#   CLUSTER   local minikube profile            (default: minikube)
#   PROD_CTX  kubectl context for production    (default: context-cadlbrqp6gq)
#   NS        kubernetes namespace              (default: vdogen)
#   GCP_KEY_FILE  service-account JSON for real GCP (default: BE/vdogen-*.json)
#   KUBECONFIG    kubeconfig mounted into compose (default: ~/.kube/config)
# ============================================================================

SHELL          := /bin/bash
.DEFAULT_GOAL  := help

# ---- Image registry / tags ------------------------------------------------
REGISTRY       ?= docker.io
ORG            ?= prasadev
VERSION        ?= latest

# ---- Kubernetes -----------------------------------------------------------
CLUSTER        ?= minikube
PROD_CTX       ?= context-cadlbrqp6gq
NS             ?= vdogen
GCP_KEY_FILE   ?= $(PWD)/BE/vdogen-e3f9070cfa09.json
KUBECONFIG     ?= $(HOME)/.kube/config
DEV_DIR        ?= $(PWD)/dev
DEV_KUBECONFIG ?= $(DEV_DIR)/kubeconfig
DEV_CA         ?= $(DEV_DIR)/minikube-ca.crt
DEV_TOKEN      ?= $(DEV_DIR)/token
DOCKER_USERNAME?=
DOCKER_PASSWORD?=

# Fail fast if the GCP service-account key referenced by the compose stack is
# missing, with a clear message about where to put it.
.PHONY: check/gcp
check/gcp:
	@if [ ! -f "$(GCP_KEY_FILE)" ]; then \
		echo "ERROR: GCP service-account key not found at:"; \
		echo "  $(GCP_KEY_FILE)"; \
		echo "Create/place the credential there (or set GCP_KEY_FILE to its path)."; \
		exit 1; \
	fi

# ---- Artifacts ------------------------------------------------------------
IMG_MASTER  := $(REGISTRY)/$(ORG)/vdogen-master
IMG_WORKER  := $(REGISTRY)/$(ORG)/vdogen-worker
IMG_STATUS  := $(REGISTRY)/$(ORG)/vdogen-status-check-worker

BE_DIR      := BE
FE_DIR      := FE
MANIFESTS   := ops/k8s-manifests
DEPLOYS     := vdogen-master vdogen-worker vdogen-status-check-worker

# master:80 (svc) -> 8081, worker/status share app label pattern
APP_SELECTOR := app

KUBECTL     := kubectl
DOCKER      := docker

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_.-]+(/[a-zA-Z_.-]+)*:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-28s\033[0m %s\n", $$1, $$2}'

# ============================================================================
# Setup / local (no cluster)
# ============================================================================

.PHONY: install
install: ## Install deps for BE and FE
	cd $(BE_DIR) && bun install
	cd $(FE_DIR) && bun install

.PHONY: run/master
run/master: ## Run BE master API server locally
	cd $(BE_DIR) && bun run src/master/index.ts

.PHONY: run/worker
run/worker: ## Run BE worker locally
	cd $(BE_DIR) && bun run src/workers/video-generator-worker.ts

.PHONY: run/status
run/status: ## Run BE status-check worker locally
	cd $(BE_DIR) && bun run src/workers/status-check-worker.ts

.PHONY: run/fe
run/fe: ## Run FE dev server locally
	cd $(FE_DIR) && bun run dev

.PHONY: dev
dev: ## Run FE + BE master together (uses -j2)
	@$(MAKE) -j2 run/fe run/master

# ============================================================================
# Docker image build
# ============================================================================

.PHONY: build/master
build/master: ## Build master image
	cd $(BE_DIR) && $(DOCKER) build -f Dockerfile.master -t $(IMG_MASTER):$(VERSION) .

.PHONY: build/worker
build/worker: ## Build worker image
	cd $(BE_DIR) && $(DOCKER) build -f Dockerfile.worker -t $(IMG_WORKER):$(VERSION) .

.PHONY: build/status
build/status: ## Build status-check image
	cd $(BE_DIR) && $(DOCKER) build -f Dockerfile.status -t $(IMG_STATUS):$(VERSION) .

.PHONY: build/be
build/be: build/master build/worker build/status ## Build all backend images

# ============================================================================
# Build + push to registry
# ============================================================================

.PHONY: push/master
push/master: build/master ## Build + push master
	$(DOCKER) push $(IMG_MASTER):$(VERSION)

.PHONY: push/worker
push/worker: build/worker ## Build + push worker
	$(DOCKER) push $(IMG_WORKER):$(VERSION)

.PHONY: push/status
push/status: build/status ## Build + push status
	$(DOCKER) push $(IMG_STATUS):$(VERSION)

.PHONY: push/be
push/be: push/master push/worker push/status ## Build + push all backend
	@echo "Pushed $(IMG_MASTER):$(VERSION), $(IMG_WORKER):$(VERSION), $(IMG_STATUS):$(VERSION)"

# ============================================================================
# Local environment (minikube for render jobs + docker compose for the rest)
#
# Model: master/worker/status + Postgres + Redis all run in Docker Compose.
# minikube is used ONLY to execute render Jobs; the compose worker/status reach
# it over a mounted kubeconfig. Nothing is deployed/pushed to the cluster here.
# ============================================================================

.PHONY: local/init
local/init: check/gcp ## [one-time] Cluster + namespace + secrets + DB schema/seed
	@# --- Kubernetes (for render Jobs only) ---
	@# --apiserver-names puts host.docker.internal into the apiserver TLS cert
	@# SANs so the compose containers can verify it when using dev/kubeconfig.
	minikube start --profile $(CLUSTER) \
		--apiserver-names=host.docker.internal
	$(KUBECTL) config use-context $(CLUSTER)
	-$(KUBECTL) --context $(CLUSTER) get ns $(NS) >/dev/null 2>&1 || \
		$(KUBECTL) --context $(CLUSTER) create ns $(NS)
	@# secret the render Job mounts as working GCP credentials (gcs-uploader).
	@if [ -n "$(GCP_KEY_FILE)" ] && [ -f "$(GCP_KEY_FILE)" ]; then \
		$(KUBECTL) --context $(CLUSTER) -n $(NS) delete secret gcp-keys-secret --ignore-not-found; \
		$(KUBECTL) --context $(CLUSTER) -n $(NS) create secret generic gcp-keys-secret \
			--from-file=key.json=$(GCP_KEY_FILE); \
	else \
		echo "WARN: GCP_KEY_FILE not set/missing; skipping gcp-keys-secret — render upload will fail."; \
	fi
	@# secret so minikube can pull docker.io/prasadev/manim for render jobs.
	@if [ -n "$(DOCKER_USERNAME)" ] && [ -n "$(DOCKER_PASSWORD)" ]; then \
		$(KUBECTL) --context $(CLUSTER) -n $(NS) delete secret docker-cred-secret --ignore-not-found; \
		$(KUBECTL) --context $(CLUSTER) -n $(NS) create secret docker-registry docker-cred-secret \
			--docker-server=https://index.docker.io/v1/ \
			--docker-username=$(DOCKER_USERNAME) \
			--docker-password=$(DOCKER_PASSWORD); \
	else \
		echo "WARN: DOCKER_USERNAME/DOCKER_PASSWORD not set; skipping docker-cred-secret — job image pull may fail."; \
	fi
	@# kubeconfig for the compose worker/status containers: the raw minikube
	@# config points at 127.0.0.1:<port>, which inside a container is the
	@# container itself. Flatten (embed certs) and rewrite the host to
	@# host.docker.internal so the containers can reach the apiserver.
	@mkdir -p $(DEV_DIR)
	$(KUBECTL) config view --raw --flatten --minify --context $(CLUSTER) > $(DEV_KUBECONFIG)
	sed -i.bak 's/127\.0\.0\.1/host.docker.internal/g; s/localhost/host.docker.internal/g' $(DEV_KUBECONFIG)
	rm -f $(DEV_KUBECONFIG).bak
	chmod 600 $(DEV_KUBECONFIG)
	@# The app runs on Bun, whose fetch shim ignores the kubeconfig's per-request
	@# CA, so expose the cluster CA for NODE_EXTRA_CA_CERTS instead.
	awk '/certificate-authority-data:/ {print $$2}' $(DEV_KUBECONFIG) | base64 -d > $(DEV_CA)
	@# Bun's fetch also drops the client CERTIFICATE used for auth, so swap to a
	@# bearer token (plain Authorization header) for the compose containers.
	-$(KUBECTL) --context $(CLUSTER) -n $(NS) get serviceaccount vdogen-render >/dev/null 2>&1 || \
		$(KUBECTL) --context $(CLUSTER) -n $(NS) create serviceaccount vdogen-render
	-$(KUBECTL) --context $(CLUSTER) get clusterrolebinding vdogen-render-admin >/dev/null 2>&1 || \
		$(KUBECTL) --context $(CLUSTER) create clusterrolebinding vdogen-render-admin \
			--clusterrole=cluster-admin --serviceaccount=$(NS):vdogen-render
	@$(KUBECTL) --context $(CLUSTER) -n $(NS) create token vdogen-render --duration=8760h > $(DEV_TOKEN)
	KUBECONFIG=$(DEV_KUBECONFIG) $(KUBECTL) config set-credentials minikube \
		--token=$$(cat $(DEV_TOKEN)) >/dev/null
	@# 4. Bring up Postgres, then run the one-time migration (+ seed) from the
	@#    host so we don't depend on migration files being baked into the image.
	docker compose up -d postgres
	@for i in $$(seq 1 30); do \
		if docker exec vdogen-postgres pg_isready -U vdogen -d vdogen >/dev/null 2>&1; then break; fi; \
		echo "waiting for postgres..."; sleep 1; \
	done
	docker exec vdogen-postgres pg_isready -U vdogen -d vdogen >/dev/null 2>&1 || \
		(echo "ERROR: postgres did not become healthy" && exit 1)
	cd $(BE_DIR) && DATABASE_URL="postgresql://vdogen:vdogen@localhost:5432/vdogen" \
		bunx prisma migrate deploy
	cd $(BE_DIR) && DATABASE_URL="postgresql://vdogen:vdogen@localhost:5432/vdogen" \
		bun run prisma/seed.ts
	docker compose stop postgres
	@echo "Local init complete: cluster ready + DB schema/seed applied."

.PHONY: local/up
local/up: check/gcp ## Build + start the full local stack (infra + servers) via docker compose
	docker compose up -d --build
	@echo "Stack up: postgres:5432, redis:6379, master:8081"

.PHONY: local/down
local/down: ## Stop and remove the local docker compose stack
	docker compose down

.PHONY: local/logs
local/logs: ## Tail logs across the compose stack
	docker compose logs -f --tail=100

# ============================================================================
# Production deploy: build+push, then refresh the running deployments
# ============================================================================

.PHONY: deploy/be
deploy/be: push/be ## Build+push backend, then point deployments at $(VERSION) and roll out
	$(KUBECTL) --context $(PROD_CTX) -n $(NS) set image \
		deployment/vdogen-master vdogen-master=$(IMG_MASTER):$(VERSION)
	$(KUBECTL) --context $(PROD_CTX) -n $(NS) set image \
		deployment/vdogen-worker vdogen-worker=$(IMG_WORKER):$(VERSION)
	$(KUBECTL) --context $(PROD_CTX) -n $(NS) set image \
		deployment/vdogen-status-check-worker vdogen-status-check-worker=$(IMG_STATUS):$(VERSION)
	$(KUBECTL) --context $(PROD_CTX) -n $(NS) rollout restart deployment $(DEPLOYS)
	$(KUBECTL) --context $(PROD_CTX) -n $(NS) rollout status deployment $(DEPLOYS)

.PHONY: deploy/fe
deploy/fe: ## Build + deploy FE to Cloudflare (separate from backend)
	cd $(FE_DIR) && bun install && bun run build && bunx wrangler deploy

.PHONY: deploy
deploy: deploy/be deploy/fe ## Deploy the whole stack

# ============================================================================
# kubectl helpers (production context)
# ============================================================================

.PHONY: k8s/status
k8s/status: ## Show backend deployment rollout/pod status
	$(KUBECTL) --context $(PROD_CTX) -n $(NS) get deployments,pods -o wide

.PHONY: k8s/logs
k8s/logs: ## Tail logs for all backend deployments
	@for d in $(DEPLOYS); do \
		echo "=== $$d ==="; \
		$(KUBECTL) --context $(PROD_CTX) -n $(NS) logs deployment/$$d --tail=50; \
	done

.PHONY: k8s/restart
k8s/restart: ## Rollout restart backend deployments in production
	$(KUBECTL) --context $(PROD_CTX) -n $(NS) rollout restart deployment $(DEPLOYS)
	$(KUBECTL) --context $(PROD_CTX) -n $(NS) rollout status deployment $(DEPLOYS)

.PHONY: prune
prune: ## Prune dangling Docker images
	$(DOCKER) image prune -f