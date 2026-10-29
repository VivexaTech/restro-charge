import { firestoreService } from "../src/lib/services/firestore-service";
import { adminDb } from "../src/lib/firebase/admin";
import { dataStore } from "../src/lib/services/data-store";
import { PATIYALA_OFFERS, RESTAURANT_ID } from "./import-patiyala-junction";

async function main() {
  console.log("Reconciling Patiyala Junction offers in Firestore & DataStore...");
  for (const offer of PATIYALA_OFFERS) {
    await firestoreService.saveOffer(RESTAURANT_ID, offer);
    dataStore.saveOfferLocally(offer);
    console.log(`  ✅ Saved offer: ${offer.name} (${offer.status})`);
  }

  console.log("Cleaning up pseudo-products...");
  const pseudoIds = [
    "prod_pj_offer_tuesday",
    "prod_pj_offer_wednesday",
    "prod_pj_offer_thursday",
    "prod_pj_offer_friday",
    "prod_pj_offer_saturday",
    "prod_pj_offer_sunday",
  ];
  for (const id of pseudoIds) {
    await adminDb.collection("restaurants").doc(RESTAURANT_ID).collection("products").doc(id).delete();
    console.log(`  🗑️ Deleted pseudo-product from Firestore: ${id}`);
  }

  const remaining = await firestoreService.getProducts(RESTAURANT_ID);
  console.log(`  📊 Remaining real products in Firestore: ${remaining.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
