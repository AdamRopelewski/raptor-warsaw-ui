from flask import Flask, jsonify, render_template, request
import requests
import os
import logging

app = Flask(__name__)
EXTERNAL_API_URL = os.getenv('EXTERNAL_API_URL', 'http://transit-service:8080/routing/connections')

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

@app.route('/')
def index():
    try:
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Error rendering template: {str(e)}")
        return "Internal Server Error", 500

@app.route('/routing/connections')
def proxy_request():
    try:
        logger.debug(f"Proxying request to: {EXTERNAL_API_URL}")
        logger.debug(f"Request params: {request.args}")
        
        response = requests.get(
            EXTERNAL_API_URL,
            params=request.args,
            timeout=10
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {str(e)}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": "Internal Server Error"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)