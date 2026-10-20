# Glossary

| Term | Plain-English meaning |
|---|---|
| **PII** | Personally Identifiable Information: data that can identify a person (name, email, phone, ID numbers). |
| **PHI** | Protected Health Information: health data tied to a person (medical record number, diagnosis with name, insurance ID). Regulated by HIPAA in the US. |
| **HIPAA** | US law protecting health information. |
| **Safe Harbor** | HIPAA method of de-identification: remove 18 listed identifiers (names, small geographic areas, dates, phone numbers, SSN, MRN, etc.). |
| **GDPR** | EU law on personal data protection. |
| **CCPA** | California privacy law. |
| **PCI-DSS** | Security standard for payment card data. |
| **DLP** | Data Loss Prevention: tools that stop sensitive data from leaking. |
| **Redaction** | Removing or blacking out sensitive content. |
| **Masking** | Replacing sensitive content with a placeholder or fake value. |
| **Tokenization (here)** | Replacing a value with a stable label like `[PERSON_1]`. |
| **De-identification** | Removing the link between data and a specific person. |
| **Recognizer** | A piece of code that finds one kind of sensitive data. |
| **Finding** | One detected sensitive item (type, position, confidence). |
| **Confidence** | How sure the detector is, from 0 to 1. |
| **False positive** | Flagged as sensitive but is not. |
| **False negative** | Sensitive but missed. More dangerous. |
| **Precision** | Of the things flagged, the share that were truly sensitive. |
| **Recall** | Of all truly sensitive things, the share we found. |
| **Regex** | Pattern-matching expression for text. |
| **Checksum / Luhn** | A built-in check digit that lets us verify a card number is structurally valid. |
| **IBAN mod-97** | Checksum used to validate international bank account numbers. |
| **NER** | Named Entity Recognition: an ML model that finds names, organizations, places in free text. |
| **ONNX** | A portable ML model format that can run in the browser. |
| **Quantized model** | A smaller, faster version of an ML model with slightly lower accuracy. |
| **Web Worker** | Browser background thread; keeps the page responsive during heavy work. |
| **Manifest V3 (MV3)** | Current Chrome extension format. |
| **Content script** | Extension code that runs inside a web page. |
| **Service worker (extension)** | Extension background script for settings/lifecycle. |
| **CSP** | Content Security Policy: browser rules limiting what code a page/extension may run. |
| **WebCrypto** | Browser's built-in encryption API. |
| **Monorepo** | One repository holding several related packages. |
| **ADR** | Architecture Decision Record: a short note on why a choice was made. |
| **E2E test** | End-to-end test that drives the real UI. |
| **Detector** | In MaskIT, an asynchronous source of findings (such as the name model) that plugs into the same pipeline as the rules. |
| **Offscreen document** | A hidden page of a Chrome extension, used here to hold the large name model, because the extension's service worker cannot. |
| **OCR** | Optical Character Recognition: reading text out of an image or a scanned page. |
| **WebAssembly (wasm)** | A compact format that lets browsers run fast compiled code; the name model and OCR engine use it. |
| **Request interception** | A test technique that answers a browser's request for a web address with local content, so tests can use real hostnames without the real site. |
| **IoU** | Intersection over Union: how much two text spans overlap, used to decide whether a finding matches a labeled value. |
| **Pre-check** | Running the name model on the prompt in the background while the user pauses typing, so the answer is ready when they press Enter. |
