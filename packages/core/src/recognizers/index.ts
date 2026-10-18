import type { Recognizer } from "../types.js";
import {
  addressRecognizer,
  emailRecognizer,
  personRecognizer,
  phoneRecognizer,
} from "./contact.js";
import { bankAccountRecognizer, creditCardRecognizer, ibanRecognizer } from "./financial.js";
import {
  ageRecognizer,
  dateRecognizer,
  dobRecognizer,
  mrnRecognizer,
  passportRecognizer,
  ssnRecognizer,
} from "./identity.js";
import { gpsRecognizer, ipRecognizer, macRecognizer } from "./network.js";
import { credentialRecognizer, secretRecognizer, urlCredentialRecognizer } from "./secrets.js";

export { customTermRecognizer } from "./custom.js";

export const defaultRecognizers: Recognizer[] = [
  emailRecognizer,
  phoneRecognizer,
  addressRecognizer,
  personRecognizer,
  creditCardRecognizer,
  ibanRecognizer,
  bankAccountRecognizer,
  ssnRecognizer,
  mrnRecognizer,
  passportRecognizer,
  dateRecognizer,
  dobRecognizer,
  ageRecognizer,
  secretRecognizer,
  credentialRecognizer,
  urlCredentialRecognizer,
  ipRecognizer,
  macRecognizer,
  gpsRecognizer,
];
