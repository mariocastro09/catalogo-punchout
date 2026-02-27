import httpx
import csv
import sys
import os

MEDUSA_API_URL = os.getenv("MEDUSA_API_URL", "http://localhost:9000/store/products")

def fetch_medusa_catalog():
    """
    Queries the Medusa store API to get all available products.
    Returns a list of products.
    """
    try:
        # Note: In production, pagination and proper API-key authentication
        # may be required if not using the public /store endpoint.
        response = httpx.get(MEDUSA_API_URL)
        response.raise_for_status()
        data = response.json()
        return data.get("products", [])
    except Exception as e:
        print(f"Failed to fetch catalog from Medusa: {e}", file=sys.stderr)
        return []

def generate_index_catalog_csv(products, output_path="catalog.csv"):
    """
    Generates an RFC4180-compliant CSV mapping Medusa products
    to standard B2B/cXML Index Catalog formats.
    """
    # Standard minimal CIF/CSV headers for procurement systems
    headers = [
        "Supplier Part ID", # Maps to SKU
        "Manufacturer Part ID",
        "Manufacturer Name",
        "Item Description", # Title/Description
        "Unit Price",
        "Unit of Measure", # Usually EA (Each)
        "Currency",
        "Lead Time"
    ]

    with open(output_path, mode='w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile, delimiter=',', quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)

        for product in products:
            title = product.get("title", "Unknown Product")
            
            # Products in Medusa have variants (which have the SKUs and prices).
            # We typically export the variants as indexable items.
            for variant in product.get("variants", []):
                sku = variant.get("sku", "UNKNOWN_SKU")
                
                # Prices are usually handled in pricing rules, but if included in Index:
                prices = variant.get("prices", [])
                unit_price = (prices[0].get("amount") / 100) if prices else 0.00
                currency = prices[0].get("currency_code", "usd").upper() if prices else "USD"

                writer.writerow([
                    sku,                    # Supplier Part ID
                    "",                     # Manufacturer Part ID (Optional)
                    "",                     # Manufacturer Name (Optional)
                    title,                  # Item Description
                    unit_price,             # Unit Price
                    "EA",                   # Unit of Measure (Each)
                    currency,               # Currency
                    "1",                    # Lead Time (Days)
                ])

    print(f"Catalog successfully generated at {output_path}")

if __name__ == "__main__":
    print("Fetching active catalog from Medusa API...")
    medusa_products = fetch_medusa_catalog()
    
    if medusa_products:
        print(f"Found {len(medusa_products)} base products.")
        generate_index_catalog_csv(medusa_products, "index_catalog.csv")
    else:
        print("No products found or failed to connect to Medusa API.")
