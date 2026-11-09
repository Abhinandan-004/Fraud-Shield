import warnings
warnings.filterwarnings("ignore")
import joblib
from utills.URL_feature_extraction import extract_features

model = joblib.load("models/URL_Detection_compreased.pkl")
print("CLASSES:", model.classes_)
print()

urls = {
    "SAFE   google":    "https://www.google.com",
    "SAFE   wikipedia": "https://www.wikipedia.org",
    "SAFE   github":    "https://github.com",
    "PHISH  ip+login":  "http://192.168.1.5/secure-login-paypal-verify.php",
    "PHISH  typo":      "http://paypa1-secure-login.verify-account.xyz/signin",
}

for name, u in urls.items():
    f = extract_features(u)
    print(name, "->", model.predict_proba(f)[0].round(3), "predict =", model.predict(f)[0])

print()
print("FEATURES FOR GOOGLE:")
print(extract_features("https://www.google.com").T)