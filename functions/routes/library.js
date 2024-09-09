/* eslint-disable require-jsdoc */
// import app from "../firebase.js";
import {onCall} from "firebase-functions/v2/https";
import {validateOnCallAuth} from "../auth/auth.js";
import {
  libraryAddItemFirestore,
  libraryGetAllFirestore,
  libraryDeleteItemFirestore,
} from "../storage/firestore/library.js";

/**
 * Cloud Function to create a new book entry.
 * This function is triggered by an on-call request and requires the user to be authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to an object containing the user's UID and the data provided.
 */
export const v1addItemToLibrary = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return libraryAddItemFirestore(uid, data);
});

/**
 * Retrieves a book from the Firestore database based on the user's UID and the book ID provided in the data.
 * This function is triggered by an on-call request and requires the user to be authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to the book data if found and the user is authenticated, otherwise null.
 */
export const v1getLibrary = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return libraryGetAllFirestore(uid, data);
});


/**
 * Requests the server delete a book, including any items in storage
 * This function is triggered by an on-call request and requires the user to be authenticated.
 *
 * @param {object} context - The context object provided by Firebase Functions, containing authentication details and data.
 * @returns {Promise<object>} A promise that resolves to the book data if found and the user is authenticated, otherwise null.
 */
export const v1deleteItemsFromLibrary = onCall({region: "europe-west1"}, async (context) => {
  const {uid, data} = await validateOnCallAuth(context);
  return libraryDeleteItemFirestore(uid, data);
});
