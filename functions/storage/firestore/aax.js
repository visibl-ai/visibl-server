/* eslint-disable require-jsdoc */
/* eslint-disable no-unused-vars */
import {
  getFirestore,
  Timestamp} from "firebase-admin/firestore";

async function aaxStoreAuthFirestore(uid, audibleUserId, auth) {
  const db = getFirestore();
  const authRef = db.collection("AAXAuth").doc(audibleUserId);
  await authRef.set({uid, audibleUserId, auth, expires: auth.expires});
}

async function aaxGetAuthByAAXIdFirestore(audibleUserId) {
  const db = getFirestore();
  const authRef = db.collection("AAXAuth").doc(audibleUserId);
  const auth = await authRef.get();
  return auth.data();
}

async function aaxGetAuthByUidFirestore(uid) {
  const db = getFirestore();
  const authRef = db.collection("AAXAuth").where("uid", "==", uid);
  const auth = await authRef.get();
  return auth.docs[0].data().auth;
}

async function aaxStoreItemsFirestore(uid, library) {
  const db = getFirestore();

  const batch = db.batch();

  for (const libraryItem of library) {
    const asin = libraryItem.asin;
    const title = libraryItem.title;
    const sku = libraryItem.sku_lite;
    const libraryRef = db.collection("UserAAXSync").doc(`${uid}:${sku}`);
    batch.set(libraryRef, {
      uid,
      title,
      asin,
      sku,
    }, {merge: true});
  }
  await batch.commit();
}

async function aaxGetItemsFirestore(uid) {
  const db = getFirestore();
  const itemsRef = db.collection("UserAAXSync").where("uid", "==", uid);
  const items = await itemsRef.get();
  return items.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function aaxAsinFromSkuFirestore(uid, sku) {
  const db = getFirestore();
  const itemRef = db.collection("UserAAXSync").doc(`${uid}:${sku}`);
  const item = await itemRef.get();

  if (!item.exists) {
    return null; // or throw an error, depending on your preference
  }

  const data = item.data();
  return data && data.asin ? data.asin : null;
}

async function aaxUpdateItemFirestore(item) {
  const db = getFirestore();
  const itemRef = db.collection("UserAAXSync").doc(item.id);
  await itemRef.update(item);
}


async function aaxGetAllAuthFirestore(expiry, lastDocId = null, limit = 100) {
  const db = getFirestore();
  const authRef = db.collection("AAXAuth");

  let query = authRef.where("expires", ">=", expiry.from)
      .where("expires", "<", expiry.to)
      .orderBy("expires")
      .limit(limit);

  if (lastDocId) {
    const lastDoc = await authRef.doc(lastDocId).get();
    query = query.startAfter(lastDoc);
  }

  const snapshot = await query.get();

  const results = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const lastVisible = snapshot.docs[snapshot.docs.length - 1];
  const hasMore = snapshot.docs.length === limit;

  return {
    results,
    lastVisible: hasMore ? lastVisible.id : null,
    hasMore,
  };
}


export {
  aaxStoreAuthFirestore,
  aaxGetAuthByAAXIdFirestore,
  aaxGetAuthByUidFirestore,
  aaxStoreItemsFirestore,
  aaxUpdateItemFirestore,
  aaxGetItemsFirestore,
  aaxGetAllAuthFirestore,
  aaxAsinFromSkuFirestore,
};
