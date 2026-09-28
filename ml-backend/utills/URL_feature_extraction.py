import pandas as pd
import numpy as np
import re
from urllib.parse import urlparse
import tldextract
import pickle

def extract_features(url: str) -> pd.DataFrame:
     
    url_str = f"[{str(url)}]"
    
    # 1. url_len
    url_len = len(url_str)
    
    # 2. check_IP
    ip_match = re.search(
        r"(([01]?\d\d?|2[0-4]\d|25[0-5])\.([01]?\d\d?|2[0-4]\d|25[0-5])\.([01]?\d\d?|2[0-4]\d|25[0-5])\."
        r"([01]?\d\d?|2[0-4]\d|25[0-5]))(?:\/|:|$)|"
        r"((0x[0-9a-fA-F]{1,2})\.(0x[0-9a-fA-F]{1,2})\.(0x[0-9a-fA-F]{1,2})\.(0x[0-9a-fA-F]{1,2}))(?:\/|:|$)|"
        r"(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}",
        url_str
    )
    check_IP = 1 if ip_match else 0
    
    # 3. url_depth
    path_segments = [s for s in urlparse(url_str).path.split("/") if s]
    url_depth = len(path_segments)
    
    # 4. hostname_len
    ext = tldextract.extract(url_str)
    hostname_len = len(ext.fqdn)
    
    # 5. sus_url
    sus_match = re.search(
        r"secure|account|update|banking|login|signin|verify|verification|confirm|admin|service|ebayisapi|webscr|password|credential|paypal|support",
        url_str,
        flags=re.IGNORECASE
    )
    sus_url = 1 if sus_match else 0
    
    # 6. count_at
    count_at = url_str.count("@")
    
    # 7. short_url
    short_match = re.search(
        r"bit\.ly|goo\.gl|shorte\.st|go2l\.ink|x\.co|ow\.ly|t\.co|tinyurl|tr\.im|is\.gd|cli\.gs|"
        r"yfrog\.com|migre\.me|ff\.im|tiny\.cc|url4\.eu|twit\.ac|su\.pr|twurl\.nl|snipurl\.com|"
        r"short\.to|BudURL\.com|ping\.fm|post\.ly|Just\.as|bkite\.com|snipr\.com|fic\.kr|loopt\.us|"
        r"doiop\.com|short\.ie|kl\.am|wp\.me|rubyurl\.com|om\.ly|to\.ly|bit\.do|t\.co|lnkd\.in|"
        r"db\.tt|qr\.ae|adf\.ly|goo\.gl|bitly\.com|cur\.lv|tinyurl\.com|ow\.ly|bit\.ly|ity\.im|"
        r"q\.gs|is\.gd|po\.st|bc\.vc|twitthis\.com|u\.to|j\.mp|buzurl\.com|cutt\.us|u\.bb|yourls\.org|"
        r"x\.co|prettylinkpro\.com|scrnch\.me|filoops\.info|vzturl\.com|qr\.net|1url\.com|tweez\.me|v\.gd|"
        r"tr\.im|link\.zip\.net",
        url_str,
        flags=re.IGNORECASE
    )
    short_url = 1 if short_match else 0
    
    # 8-13. special character counts
    count_dot = url_str.count(".")
    count_hyphen = url_str.count("-")
    count_slash = url_str.count("/")
    count_question = url_str.count("?")
    count_equal = url_str.count("=")
    count_percent = url_str.count("%")
    
    # 14-15. digit metrics
    count_digits = sum(c.isdigit() for c in url_str)
    digit_ratio = count_digits / (url_len if url_len != 0 else 1)
    
    # Match the exact column names and order from training
    features = {
        'url_len': [url_len],
        'check_IP': [check_IP],
        'url_depth': [url_depth],
        'hostname_len': [hostname_len],
        'sus_url': [sus_url],
        'count_at': [count_at],
        'short_url': [short_url],
        'count_dot': [count_dot],
        'count_hyphen': [count_hyphen],
        'count_slash': [count_slash],
        'count_question': [count_question],
        'count_equal': [count_equal],
        'count_percent': [count_percent],
        'count_digits': [count_digits],
        'digit_ratio': [digit_ratio]
    }
    
    return pd.DataFrame(features)