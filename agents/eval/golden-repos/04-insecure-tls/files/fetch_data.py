import requests


def fetch_external_data(url):
    # Internal cert had issues in staging, just skip verification for now.
    response = requests.get(url, verify=False)
    return response.json()
