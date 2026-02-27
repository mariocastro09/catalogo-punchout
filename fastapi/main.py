from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response, HTMLResponse
import defusedxml.ElementTree as ET
from pydantic import BaseModel
from typing import List
import jwt
import httpx
import os
import uuid
from datetime import datetime, timedelta, timezone

app = FastAPI(title="Punchout Middleware", description="FastAPI middleware for mapping cXML to MedusaJS")

# ── Configuration (set via Docker Compose env vars) ──────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "supersecret")
STOREFRONT_PUBLIC_URL = os.getenv("STOREFRONT_PUBLIC_URL", "http://localhost:8002")
MEDUSA_BACKEND_URL = os.getenv("MEDUSA_BACKEND_URL", "http://medusa:9000")
MEDUSA_PUBLISHABLE_KEY = os.getenv(
    "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
    "pk_78469e8fbf9368a553e606bb564cc5180c1af4b2154d28ccaba15b44131b30a2",
)

# ── Medusa API helpers ────────────────────────────────────────────────────────

def _medusa_headers() -> dict:
    """Headers required for all Medusa Store API calls."""
    return {
        "Content-Type": "application/json",
        "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    }


async def get_or_create_b2b_customer(company_id: str) -> str | None:
    """
    Looks up an existing Punchout B2B customer in Medusa by the synthetic email
    `punchout_<company_id>@punchout.local`. If it doesn't exist yet, creates it.

    Returns the Medusa JWT token (Bearer) for that customer, or None on failure.
    The approach: register the customer with a deterministic password derived from
    the shared JWT_SECRET so FastAPI can always re-authenticate without storing state.
    """
    email = f"punchout_{company_id}@punchout.local"
    # Deterministic password — never exposed to humans, only used internally.
    password = jwt.encode({"sub": company_id}, JWT_SECRET, algorithm="HS256")[:32]

    async with httpx.AsyncClient(timeout=10.0) as client:
        # ── 1. Attempt login first (most common path) ──────────────────────
        login_res = await client.post(
            f"{MEDUSA_BACKEND_URL}/auth/customer/emailpass",
            json={"email": email, "password": password},
            headers=_medusa_headers(),
        )
        if login_res.status_code == 200:
            medusa_token = login_res.json().get("token")
            print(f"[Punchout] Authenticated existing B2B customer: {email}")
            return medusa_token

        # ── 2. Customer doesn't exist → register then create ───────────────
        if login_res.status_code in (401, 404):
            # Step 2a: Register auth identity
            reg_res = await client.post(
                f"{MEDUSA_BACKEND_URL}/auth/customer/emailpass/register",
                json={"email": email, "password": password},
                headers=_medusa_headers(),
            )
            if reg_res.status_code not in (200, 201):
                print(f"[Punchout] Failed to register B2B customer auth: {reg_res.text}")
                return None

            reg_token = reg_res.json().get("token")

            # Step 2b: Create the customer profile
            create_res = await client.post(
                f"{MEDUSA_BACKEND_URL}/store/customers",
                json={
                    "email": email,
                    "first_name": company_id,
                    "last_name": "(Punchout B2B)",
                    "company_name": company_id,
                },
                headers={
                    **_medusa_headers(),
                    "Authorization": f"Bearer {reg_token}",
                },
            )
            if create_res.status_code not in (200, 201):
                print(f"[Punchout] Failed to create B2B customer profile: {create_res.text}")

            # Step 2c: Login to get a permanent session token
            login_res2 = await client.post(
                f"{MEDUSA_BACKEND_URL}/auth/customer/emailpass",
                json={"email": email, "password": password},
                headers=_medusa_headers(),
            )
            if login_res2.status_code == 200:
                medusa_token = login_res2.json().get("token")
                print(f"[Punchout] Created and authenticated new B2B customer: {email}")
                return medusa_token

        print(f"[Punchout] Could not authenticate B2B customer. Medusa responded: {login_res.status_code}")
        return None

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Punchout Middleware"}

@app.get("/api/punchout/test", response_class=HTMLResponse)
async def punchout_test_form():
    """
    Returns a visual eProcurement Simulator UI to test the full Punchout flow.
    Simulates what SAP Ariba, Coupa, etc. would do via buttons.
    """
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>eProcurement Simulator — Punchout Test Console</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
        <style>
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: 'Inter', system-ui, sans-serif;
                background: #06091a;
                color: #e2e8f0;
                min-height: 100vh;
                overflow-x: hidden;
            }
            body::before {
                content: '';
                position: fixed;
                top: -50%; left: -50%;
                width: 200%; height: 200%;
                background: radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.08) 0%, transparent 50%),
                             radial-gradient(ellipse at 70% 80%, rgba(16,185,129,0.06) 0%, transparent 50%);
                z-index: -1;
                animation: bgShift 20s ease-in-out infinite alternate;
            }
            @keyframes bgShift {
                0% { transform: translate(0, 0); }
                100% { transform: translate(-5%, 3%); }
            }

            .app { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }

            /* Header */
            .header {
                text-align: center;
                margin-bottom: 2.5rem;
                padding-bottom: 2rem;
                border-bottom: 1px solid rgba(148,163,184,0.1);
            }
            .header-badge {
                display: inline-flex; align-items: center; gap: .5rem;
                background: rgba(59,130,246,0.12);
                border: 1px solid rgba(59,130,246,0.25);
                color: #60a5fa;
                font-size: .75rem; font-weight: 600;
                padding: .35rem .9rem; border-radius: 50px;
                margin-bottom: 1rem; text-transform: uppercase; letter-spacing: .06em;
            }
            .header-badge .dot { width: 7px; height: 7px; background: #3b82f6; border-radius: 50%; animation: pulse 2s infinite; }
            @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
            .header h1 { font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, #f8fafc, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1.3; }
            .header p { color: #64748b; margin-top: .5rem; font-size: .95rem; }

            /* Stepper */
            .stepper {
                display: flex; justify-content: center; gap: 0; margin-bottom: 2.5rem;
                background: rgba(30,41,59,0.5);
                border-radius: 12px; padding: .75rem 1rem;
                border: 1px solid rgba(148,163,184,0.08);
            }
            .step-indicator {
                display: flex; align-items: center; gap: .6rem;
                padding: .5rem 1.2rem;
                font-size: .8rem; font-weight: 600; color: #475569;
                position: relative; transition: all 0.3s;
            }
            .step-indicator .num {
                width: 26px; height: 26px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: .75rem; font-weight: 700;
                background: rgba(71,85,105,0.3); border: 1.5px solid #334155;
                transition: all 0.3s;
            }
            .step-indicator.active { color: #e2e8f0; }
            .step-indicator.active .num { background: #3b82f6; border-color: #3b82f6; color: #fff; box-shadow: 0 0 12px rgba(59,130,246,0.4); }
            .step-indicator.done { color: #10b981; }
            .step-indicator.done .num { background: #10b981; border-color: #10b981; color: #fff; }
            .step-connector { width: 40px; display: flex; align-items: center; justify-content: center; }
            .step-connector::after { content: ''; width: 100%; height: 2px; background: #334155; border-radius: 2px; }
            .step-connector.done::after { background: #10b981; }

            /* Cards */
            .card {
                background: rgba(15,23,42,0.7);
                border: 1px solid rgba(148,163,184,0.1);
                border-radius: 16px;
                padding: 2rem;
                margin-bottom: 1.5rem;
                backdrop-filter: blur(12px);
                transition: border-color 0.3s, box-shadow 0.3s;
            }
            .card:hover { border-color: rgba(59,130,246,0.2); }
            .card.active-card { border-color: rgba(59,130,246,0.35); box-shadow: 0 0 30px rgba(59,130,246,0.08); }
            .card.success-card { border-color: rgba(16,185,129,0.35); box-shadow: 0 0 30px rgba(16,185,129,0.08); }
            .card-header { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.25rem; }
            .card-icon {
                width: 40px; height: 40px; border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
                font-size: 1.2rem;
            }
            .card-icon.blue { background: rgba(59,130,246,0.15); }
            .card-icon.green { background: rgba(16,185,129,0.15); }
            .card-icon.purple { background: rgba(139,92,246,0.15); }
            .card-icon.amber { background: rgba(245,158,11,0.15); }
            .card-header h2 { font-size: 1.1rem; font-weight: 700; }
            .card-header small { display: block; color: #64748b; font-size: .78rem; font-weight: 400; margin-top: 2px; }

            /* Company Presets */
            .company-grid {
                display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem;
                margin-bottom: 1.25rem;
            }
            .company-btn {
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                gap: .5rem;
                padding: 1.25rem 1rem;
                border-radius: 12px;
                border: 2px solid rgba(148,163,184,0.12);
                background: rgba(30,41,59,0.4);
                color: #cbd5e1; cursor: pointer;
                transition: all 0.25s;
                font-family: inherit;
            }
            .company-btn:hover { border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.08); color: #f1f5f9; transform: translateY(-2px); }
            .company-btn.selected { border-color: #3b82f6; background: rgba(59,130,246,0.12); color: #fff; box-shadow: 0 0 20px rgba(59,130,246,0.15); }
            .company-btn .logo { font-size: 1.8rem; }
            .company-btn .name { font-weight: 600; font-size: .85rem; }
            .company-btn .desc { font-size: .7rem; color: #64748b; }

            /* Toggle Section */
            .level-toggle {
                display: flex; gap: .5rem; margin-bottom: 1.25rem;
                background: rgba(30,41,59,0.5); border-radius: 10px; padding: .35rem;
            }
            .level-btn {
                flex: 1; padding: .7rem; text-align: center;
                border-radius: 8px; border: none;
                background: transparent; color: #94a3b8;
                font-weight: 600; font-size: .82rem;
                cursor: pointer; transition: all 0.2s;
                font-family: inherit;
            }
            .level-btn.active { background: rgba(59,130,246,0.15); color: #60a5fa; box-shadow: 0 0 12px rgba(59,130,246,0.1); }

            .sku-input-row {
                display: none; align-items: center; gap: .75rem;
                margin-bottom: 1rem; animation: fadeIn .3s;
            }
            .sku-input-row.visible { display: flex; }
            .sku-input-row label { font-size: .82rem; font-weight: 600; color: #94a3b8; white-space: nowrap; }
            .sku-input-row input {
                flex: 1; padding: .6rem .9rem; border-radius: 8px;
                border: 1px solid #334155; background: rgba(15,23,42,0.8);
                color: #e2e8f0; font-family: 'JetBrains Mono', monospace; font-size: .85rem;
                outline: none; transition: border-color .2s;
            }
            .sku-input-row input:focus { border-color: #3b82f6; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

            /* Primary Action Button */
            .action-btn {
                width: 100%; padding: 1rem;
                border-radius: 12px; border: none;
                font-weight: 700; font-size: 1rem;
                cursor: pointer; transition: all 0.3s;
                font-family: inherit;
                display: flex; align-items: center; justify-content: center; gap: .6rem;
            }
            .action-btn.launch {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: #fff;
                box-shadow: 0 4px 15px rgba(59,130,246,0.3);
            }
            .action-btn.launch:hover { box-shadow: 0 6px 25px rgba(59,130,246,0.45); transform: translateY(-1px); }
            .action-btn.launch:active { transform: translateY(0); }
            .action-btn:disabled { opacity: .5; cursor: not-allowed; transform: none !important; }

            .action-btn.cart-btn {
                background: linear-gradient(135deg, #10b981, #059669);
                color: #fff;
                box-shadow: 0 4px 15px rgba(16,185,129,0.3);
            }
            .action-btn.cart-btn:hover { box-shadow: 0 6px 25px rgba(16,185,129,0.45); transform: translateY(-1px); }

            /* Result Panels */
            .result-panel {
                display: none; margin-top: 1.5rem; animation: fadeIn 0.4s;
            }
            .result-panel.visible { display: block; }

            .result-section {
                background: rgba(15,23,42,0.6);
                border: 1px solid rgba(148,163,184,0.1);
                border-radius: 12px;
                padding: 1.25rem;
                margin-bottom: 1rem;
            }
            .result-section h4 {
                font-size: .78rem; font-weight: 600; text-transform: uppercase;
                letter-spacing: .06em; color: #64748b; margin-bottom: .75rem;
                display: flex; align-items: center; gap: .5rem;
            }
            .result-section h4 .tag {
                font-size: .65rem; padding: .15rem .5rem; border-radius: 4px;
                font-weight: 700; text-transform: uppercase;
            }
            .tag-ok { background: rgba(16,185,129,0.15); color: #34d399; }
            .tag-jwt { background: rgba(245,158,11,0.15); color: #fbbf24; }

            pre.code-block {
                background: #0a0f1e;
                border: 1px solid rgba(148,163,184,0.08);
                border-radius: 8px;
                padding: 1rem; margin: 0;
                font-family: 'JetBrains Mono', monospace;
                font-size: .78rem; line-height: 1.6;
                overflow-x: auto; color: #a7f3d0;
                white-space: pre-wrap; word-break: break-all;
            }
            pre.code-block.jwt-token { color: #fbbf24; }
            pre.code-block.jwt-decoded { color: #c4b5fd; }

            .redirect-link-box {
                display: flex; align-items: center; gap: .75rem;
                background: rgba(16,185,129,0.08);
                border: 1px solid rgba(16,185,129,0.25);
                border-radius: 10px; padding: 1rem;
                margin-top: 1rem;
            }
            .redirect-link-box .icon { font-size: 1.5rem; }
            .redirect-link-box .info { flex: 1; }
            .redirect-link-box .info p { font-size: .78rem; color: #64748b; margin-bottom: .35rem; }
            .redirect-link-box a {
                color: #34d399; font-weight: 600; font-size: .9rem;
                text-decoration: none; word-break: break-all;
                transition: color 0.2s;
            }
            .redirect-link-box a:hover { color: #6ee7b7; text-decoration: underline; }
            .open-btn {
                padding: .5rem 1.2rem; border-radius: 8px;
                background: #10b981; color: #fff; border: none;
                font-weight: 600; font-size: .82rem; cursor: pointer;
                font-family: inherit; transition: all 0.2s;
                white-space: nowrap;
            }
            .open-btn:hover { background: #059669; }

            /* Cart Section */
            .cart-item-row {
                display: grid; grid-template-columns: 1fr 80px 100px auto; gap: .75rem;
                align-items: center; margin-bottom: .6rem;
            }
            .cart-item-row input, .cart-item-row select {
                padding: .55rem .75rem; border-radius: 8px;
                border: 1px solid #334155; background: rgba(15,23,42,0.8);
                color: #e2e8f0; font-family: inherit; font-size: .85rem;
                outline: none; transition: border-color .2s;
            }
            .cart-item-row input:focus { border-color: #10b981; }
            .cart-remove {
                width: 32px; height: 32px; border-radius: 8px;
                border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.08);
                color: #f87171; cursor: pointer; font-size: 1rem;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s;
            }
            .cart-remove:hover { background: rgba(239,68,68,0.2); }
            .cart-labels {
                display: grid; grid-template-columns: 1fr 80px 100px auto; gap: .75rem;
                margin-bottom: .5rem;
                font-size: .72rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: .04em;
            }
            .add-item-btn {
                display: inline-flex; align-items: center; gap: .4rem;
                padding: .45rem .9rem; border-radius: 8px;
                background: transparent; border: 1px dashed #334155;
                color: #64748b; cursor: pointer; font-size: .8rem;
                font-family: inherit; transition: all 0.2s; margin-top: .5rem;
            }
            .add-item-btn:hover { border-color: #10b981; color: #10b981; }

            /* Loading Spinner */
            .spinner {
                display: inline-block; width: 18px; height: 18px;
                border: 2.5px solid rgba(255,255,255,0.25); border-top-color: #fff;
                border-radius: 50%;
                animation: spin .6s linear infinite;
            }
            @keyframes spin { to { transform: rotate(360deg); } }

            /* Responsive */
            @media (max-width: 640px) {
                .company-grid { grid-template-columns: 1fr; }
                .stepper { flex-wrap: wrap; gap: .25rem; justify-content: center; }
                .step-connector { width: 20px; }
                .cart-item-row { grid-template-columns: 1fr; }
                .cart-labels { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="app">
            <!-- Header -->
            <div class="header">
                <div class="header-badge"><span class="dot"></span> Live Middleware</div>
                <h1>eProcurement Simulator</h1>
                <p>Test the full Punchout flow as if you were SAP Ariba, Coupa, or any cXML system.</p>
            </div>

            <!-- Stepper -->
            <div class="stepper">
                <div class="step-indicator active" id="step-1"><span class="num">1</span> Configure</div>
                <div class="step-connector" id="conn-1"></div>
                <div class="step-indicator" id="step-2"><span class="num">2</span> Setup</div>
                <div class="step-connector" id="conn-2"></div>
                <div class="step-indicator" id="step-3"><span class="num">3</span> Shop</div>
                <div class="step-connector" id="conn-3"></div>
                <div class="step-indicator" id="step-4"><span class="num">4</span> Return</div>
            </div>

            <!-- STEP 1: Configure -->
            <div class="card active-card" id="card-config">
                <div class="card-header">
                    <div class="card-icon blue">🏢</div>
                    <div>
                        <h2>Select Buying Organization</h2>
                        <small>Choose which eProcurement system is initiating the Punchout session.</small>
                    </div>
                </div>

                <div class="company-grid">
                    <button class="company-btn selected" onclick="selectCompany(this, 'AcmeCorp', 'AN01000000001')" id="btn-acme">
                        <span class="logo">🏭</span>
                        <span class="name">Acme Corp</span>
                        <span class="desc">SAP Ariba Network</span>
                    </button>
                    <button class="company-btn" onclick="selectCompany(this, 'GlobalTrade_Inc', 'DUNS-987654321')">
                        <span class="logo">🌐</span>
                        <span class="name">GlobalTrade Inc</span>
                        <span class="desc">Coupa BSM</span>
                    </button>
                    <button class="company-btn" onclick="selectCompany(this, 'TechStart_LLC', 'CUSTOM-0042')">
                        <span class="logo">🚀</span>
                        <span class="name">TechStart LLC</span>
                        <span class="desc">Custom OCI</span>
                    </button>
                </div>

                <div class="level-toggle">
                    <button class="level-btn active" id="lvl1-btn" onclick="setLevel(1)">⚡ Level 1 — Browse Catalog</button>
                    <button class="level-btn" id="lvl2-btn" onclick="setLevel(2)">🎯 Level 2 — Deep Link to SKU</button>
                </div>

                <div class="sku-input-row" id="sku-row">
                    <label>Product SKU:</label>
                    <input type="text" id="sku-input" value="variant_01JEXAMPLE" placeholder="e.g. variant_01J...">
                </div>

                <button class="action-btn launch" id="launch-btn" onclick="launchPunchout()">
                    🚀 Launch PunchOut Setup Request
                </button>
            </div>

            <!-- STEP 2: Setup Response -->
            <div class="result-panel" id="setup-result-panel">
                <div class="card success-card" id="card-setup">
                    <div class="card-header">
                        <div class="card-icon green">✅</div>
                        <div>
                            <h2>PunchOut Setup Response</h2>
                            <small>FastAPI processed the cXML and returned a redirect URL with a signed JWT.</small>
                        </div>
                    </div>

                    <div class="result-section">
                        <h4>📄 cXML Response <span class="tag tag-ok">200 OK</span></h4>
                        <pre class="code-block" id="xml-response">Loading...</pre>
                    </div>

                    <div class="result-section">
                        <h4>🔑 JWT Auth Token <span class="tag tag-jwt">HS256</span></h4>
                        <pre class="code-block jwt-token" id="jwt-raw">Loading...</pre>
                    </div>

                    <div class="result-section">
                        <h4>🔓 Decoded JWT Payload</h4>
                        <pre class="code-block jwt-decoded" id="jwt-decoded">Loading...</pre>
                    </div>

                    <div class="redirect-link-box">
                        <span class="icon">🔗</span>
                        <div class="info">
                            <p>This is the StartPage URL that the eProcurement system would redirect the user to:</p>
                            <a id="redirect-link" href="#" target="_blank">—</a>
                        </div>
                        <button class="open-btn" id="open-storefront-btn" onclick="openStorefront()">Open Storefront →</button>
                    </div>
                </div>
            </div>

            <!-- STEP 4: Cart Return -->
            <div class="result-panel" id="cart-panel">
                <div class="card" id="card-cart">
                    <div class="card-header">
                        <div class="card-icon amber">🛒</div>
                        <div>
                            <h2>Simulate Cart Transfer</h2>
                            <small>Mock a shopper completing their cart and returning it to the eProcurement system.</small>
                        </div>
                    </div>

                    <div class="cart-labels">
                        <span>Product Name</span>
                        <span>Qty</span>
                        <span>Unit Price</span>
                        <span></span>
                    </div>

                    <div id="cart-items">
                        <div class="cart-item-row">
                            <input type="text" value="Medusa T-Shirt (Black / L)" placeholder="Product name">
                            <input type="number" value="2" min="1" placeholder="Qty">
                            <input type="text" value="25.00" placeholder="Price">
                            <button class="cart-remove" onclick="this.parentElement.remove()">✕</button>
                        </div>
                    </div>

                    <button class="add-item-btn" onclick="addCartItem()">+ Add Item</button>

                    <button class="action-btn cart-btn" style="margin-top: 1.25rem;" onclick="submitCartTransfer()">
                        📦 Transfer Cart to eProcurement
                    </button>

                    <div class="result-panel" id="cart-result-panel">
                        <div class="result-section" style="margin-top: 1rem;">
                            <h4>📋 Generated cXML PunchOutOrderMessage</h4>
                            <pre class="code-block" id="cart-cxml-result">Awaiting transfer...</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            // ——— State ———
            let selectedCompany = 'AcmeCorp';
            let selectedDomain = 'AN01000000001';
            let punchoutLevel = 1;
            let currentRedirectUrl = '';

            // ——— Company Selection ———
            function selectCompany(btn, company, domain) {
                document.querySelectorAll('.company-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedCompany = company;
                selectedDomain = domain;
            }

            // ——— Level Toggle ———
            function setLevel(level) {
                punchoutLevel = level;
                document.getElementById('lvl1-btn').classList.toggle('active', level === 1);
                document.getElementById('lvl2-btn').classList.toggle('active', level === 2);
                document.getElementById('sku-row').classList.toggle('visible', level === 2);
            }

            // ——— Build cXML from UI state ———
            function buildCXML() {
                const sku = document.getElementById('sku-input').value.trim();
                let selectedItemBlock = '';
                if (punchoutLevel === 2 && sku) {
                    selectedItemBlock = `
            <SelectedItem>
                <ItemID>
                    <SupplierPartID>${sku}</SupplierPartID>
                </ItemID>
            </SelectedItem>`;
                }

                return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.038/cXML.dtd">
<cXML payloadID="${Date.now()}@simulator.local" timestamp="${new Date().toISOString()}">
    <Header>
        <From><Credential domain="NetworkId"><Identity>${selectedCompany}</Identity></Credential></From>
        <To><Credential domain="NetworkId"><Identity>Supplier</Identity></Credential></To>
        <Sender><Credential domain="NetworkId"><Identity>${selectedCompany}</Identity></Credential></Sender>
    </Header>
    <Request>
        <PunchOutSetupRequest operation="create">
            <BuyerCookie>cookie-${Date.now()}</BuyerCookie>
            <BrowserFormPost>
                <URL>https://procurement.example.com/return</URL>
            </BrowserFormPost>${selectedItemBlock}
        </PunchOutSetupRequest>
    </Request>
</cXML>`;
            }

            // ——— Decode JWT (simple base64 decode of payload) ———
            function decodeJWT(token) {
                try {
                    const parts = token.split('.');
                    if (parts.length !== 3) return null;
                    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                    return payload;
                } catch { return null; }
            }

            // ——— Step management ———
            function setStep(n) {
                for (let i = 1; i <= 4; i++) {
                    const el = document.getElementById('step-' + i);
                    el.classList.remove('active', 'done');
                    if (i < n) el.classList.add('done');
                    if (i === n) el.classList.add('active');
                }
                for (let i = 1; i <= 3; i++) {
                    const c = document.getElementById('conn-' + i);
                    c.classList.toggle('done', i < n);
                }
            }

            // ——— Launch Punchout ———
            async function launchPunchout() {
                const btn = document.getElementById('launch-btn');
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner"></span> Sending cXML Setup Request...';

                const cxml = buildCXML();

                try {
                    const response = await fetch('/api/punchout/setup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/xml' },
                        body: cxml
                    });
                    const xmlText = await response.text();

                    // Format XML nicely
                    document.getElementById('xml-response').textContent = xmlText.trim();

                    // Extract StartPage URL from response
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                    const urlNode = xmlDoc.querySelector('URL');
                    const redirectUrl = urlNode ? urlNode.textContent : '';
                    currentRedirectUrl = redirectUrl;

                    // Extract & decode JWT
                    const tokenMatch = redirectUrl.match(/token=([^&]+)/);
                    if (tokenMatch) {
                        const jwt = tokenMatch[1];
                        document.getElementById('jwt-raw').textContent = jwt;
                        const decoded = decodeJWT(jwt);
                        if (decoded) {
                            // Convert exp to readable date
                            if (decoded.exp) {
                                decoded._expires_readable = new Date(decoded.exp * 1000).toLocaleString();
                            }
                            document.getElementById('jwt-decoded').textContent = JSON.stringify(decoded, null, 2);
                        }
                    }

                    // Show redirect link
                    const linkEl = document.getElementById('redirect-link');
                    linkEl.href = redirectUrl;
                    linkEl.textContent = redirectUrl;

                    // Reveal panels
                    document.getElementById('setup-result-panel').classList.add('visible');
                    document.getElementById('cart-panel').classList.add('visible');
                    setStep(2);

                    // Scroll to result
                    document.getElementById('setup-result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });

                } catch (err) {
                    document.getElementById('xml-response').textContent = 'Error: ' + err.message;
                    document.getElementById('setup-result-panel').classList.add('visible');
                }

                btn.disabled = false;
                btn.innerHTML = '🚀 Launch PunchOut Setup Request';
            }

            // ——— Open Storefront ———
            function openStorefront() {
                if (currentRedirectUrl) {
                    setStep(3);
                    window.open(currentRedirectUrl, '_blank');
                }
            }

            // ——— Cart Items ———
            function addCartItem() {
                const container = document.getElementById('cart-items');
                const row = document.createElement('div');
                row.className = 'cart-item-row';
                row.innerHTML = `
                    <input type="text" value="" placeholder="Product name">
                    <input type="number" value="1" min="1" placeholder="Qty">
                    <input type="text" value="0.00" placeholder="Price">
                    <button class="cart-remove" onclick="this.parentElement.remove()">✕</button>
                `;
                container.appendChild(row);
            }

            // ——— Cart Transfer ———
            async function submitCartTransfer() {
                const rows = document.querySelectorAll('#cart-items .cart-item-row');
                const items = [];
                rows.forEach(row => {
                    const inputs = row.querySelectorAll('input');
                    items.push({
                        id: 'variant_' + Math.random().toString(36).substr(2, 8),
                        title: inputs[0].value,
                        quantity: parseInt(inputs[1].value) || 1,
                        unit_price: parseFloat(inputs[2].value) || 0,
                        currency_code: 'usd',
                        description: inputs[0].value
                    });
                });

                const payload = {
                    session_id: 'mock-session-' + Date.now(),
                    browser_form_post_url: 'https://procurement.example.com/return',
                    buyer_cookie: 'cookie-' + Date.now(),
                    currency: 'USD',
                    items
                };

                try {
                    const response = await fetch('/api/punchout/order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const json = await response.json();
                    document.getElementById('cart-cxml-result').textContent =
                        typeof json.cxml_base64 === 'string' ? json.cxml_base64 : JSON.stringify(json, null, 2);
                    document.getElementById('cart-result-panel').classList.add('visible');
                    setStep(4);
                } catch (err) {
                    document.getElementById('cart-cxml-result').textContent = 'Error: ' + err.message;
                    document.getElementById('cart-result-panel').classList.add('visible');
                }
            }
        </script>
    </body>
    </html>
    """

@app.post("/api/punchout/setup")
async def punchout_setup(request: Request):
    """
    Handles the PunchOutSetupRequest.
    Extracts authentication and buyer details, sets up a session,
    and returns a StartPage URL for the user to shop.

    Level 2 Support: If `<SelectedItem>` is present, deep-links
    directly to the Product Detail Page (PDP).
    """
    try:
        xml_data = await request.body()
        # Parse XML securely to prevent XXE
        root = ET.fromstring(xml_data)
        
        request_node = root.find("Request")
        header_node = root.find("Header")
        if request_node is None or header_node is None:
            raise HTTPException(status_code=400, detail="Missing Request or Header node")
            
        setup_request = request_node.find("PunchOutSetupRequest")
        if setup_request is None:
            raise HTTPException(status_code=400, detail="Missing PunchOutSetupRequest node")
            
        # Extract B2B Identity (CustomerGroup / Company Name)
        # e.g. <Header><From><Credential domain="NetworkId"><Identity>AcmeCorp</Identity>...
        from_identity_node = header_node.find(".//From/Credential/Identity")
        b2b_company_identity = from_identity_node.text if from_identity_node is not None else "generic_b2b_user"
            
        buyer_cookie_node = setup_request.find("BuyerCookie")
        browser_form_post_node = setup_request.find("BrowserFormPost/URL")
        
        buyer_cookie = buyer_cookie_node.text if buyer_cookie_node is not None else "Unknown"
        browser_form_post_url = browser_form_post_node.text if browser_form_post_node is not None else "Unknown"
        
        print(f"Extracted BuyerCookie: {buyer_cookie}")
        print(f"Extracted BrowserFormPost URL: {browser_form_post_url}")
        print(f"B2B CustomerGroup Identity: {b2b_company_identity}")

        # Level 2 Punchout: Check for SelectedItem
        selected_item_node = setup_request.find(".//SelectedItem/ItemID/SupplierPartID")
        sku = selected_item_node.text if selected_item_node is not None else None

        # ── Provision real Medusa B2B session ─────────────────────────────
        session_id = str(uuid.uuid4())

        # Call Medusa to find-or-create the B2B customer for this company identity.
        # The returned token is a valid Medusa JWT the storefront can use directly.
        medusa_jwt = await get_or_create_b2b_customer(b2b_company_identity)

        if medusa_jwt:
            print(f"[Punchout] Medusa B2B session provisioned for {b2b_company_identity}")
        else:
            print(f"[Punchout] WARNING: Could not provision Medusa session for {b2b_company_identity}. User will browse anonymously.")

        # ── Build & sign the Punchout JWT ──────────────────────────────────
        # This JWT is short-lived (15 min). It carries:
        #   - b2b_company_id: the identity for display / group resolution
        #   - medusa_jwt: the real Medusa Bearer token the storefront sets as _medusa_jwt
        #   - sku: only on Level 2 deep-links
        #   - session_id / buyer_cookie_url: for cart return correlation
        payload_data = {
            "b2b_company_id": b2b_company_identity,
            "medusa_jwt": medusa_jwt,          # may be None — storefront handles gracefully
            "session_id": session_id,
            "sku": sku,
            "browser_form_post_url": browser_form_post_url,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        }
        auth_token = jwt.encode(payload_data, JWT_SECRET, algorithm="HS256")

        # ── Build the StartPage redirect URL ──────────────────────────────
        storefront_login_url = f"{STOREFRONT_PUBLIC_URL}/api/punchout/login"
        redirect_url = f"{storefront_login_url}?token={auth_token}"
        
        response_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.038/cXML.dtd">
        <cXML payloadID="12345@middleware" timestamp="2026-02-24T00:00:00Z">
            <Response>
                <Status code="200" text="OK"/>
                <PunchOutSetupResponse>
                    <StartPage>
                        <URL>{redirect_url}</URL>
                    </StartPage>
                </PunchOutSetupResponse>
            </Response>
        </cXML>
        """
        return Response(content=response_xml, media_type="application/xml")
    
    except ET.ParseError:
        raise HTTPException(status_code=400, detail="Invalid XML payload")

class CartItem(BaseModel):
    id: str
    title: str
    quantity: int
    unit_price: float # Must be decimal/float in Medusa
    currency_code: str
    description: str = ""

class PunchoutCartReturn(BaseModel):
    session_id: str
    browser_form_post_url: str
    buyer_cookie: str
    currency: str
    items: List[CartItem]

@app.post("/api/punchout/order")
async def punchout_order(payload: PunchoutCartReturn):
    """
    Handles the PunchOutOrderMessage (Cart return).
    Called by the Storefront when the user clicks "Transfer Cart".
    It translates the Medusa JSON cart into the cXML standard, 
    and returns it to the Storefront so it can render a hidden auto-submit HTML form.
    """
    
    total_amount = sum(item.quantity * item.unit_price for item in payload.items)
    
    # 1. Build the ItemIn XML elements
    items_xml = ""
    for idx, item in enumerate(payload.items, start=1):
        items_xml += f"""
                <ItemIn quantity="{item.quantity}">
                    <ItemID>
                        <SupplierPartID>{item.id}</SupplierPartID>
                    </ItemID>
                    <ItemDetail>
                        <UnitPrice>
                            <Money currency="{payload.currency}">{item.unit_price:.2f}</Money>
                        </UnitPrice>
                        <Description xml:lang="en">{item.title}</Description>
                        <UnitOfMeasure>EA</UnitOfMeasure>
                        <Classification domain="UNSPSC">00000000</Classification>
                    </ItemDetail>
                </ItemIn>"""

    # 2. Build the full cXML Payload
    # Note: A real implementation would dynamically fetch Supplier Identity configs from the Database
    cxml_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.038/cXML.dtd">
<cXML payloadID="order-return-{payload.session_id}@middleware" timestamp="2026-02-24T00:00:00Z">
    <Header>
        <From><Credential domain="NetworkId"><Identity>Supplier</Identity></Credential></From>
        <To><Credential domain="NetworkId"><Identity>BuyerNetwork</Identity></Credential></To>
        <Sender><Credential domain="NetworkId"><Identity>Supplier</Identity></Credential></Sender>
    </Header>
    <Message>
        <PunchOutOrderMessage>
            <BuyerCookie>{payload.buyer_cookie}</BuyerCookie>
            <PunchOutOrderMessageHeader operationAllowed="edit">
                <Total>
                    <Money currency="{payload.currency}">{total_amount:.2f}</Money>
                </Total>
            </PunchOutOrderMessageHeader>
            {items_xml}
        </PunchOutOrderMessage>
    </Message>
</cXML>
"""

    return {
        "status": "success",
        "redirect_url": payload.browser_form_post_url,
        "cxml_base64": cxml_response # Return as plain text for the Storefront to Base64 encode into an HTML form
    }
