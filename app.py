from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import requests

app = Flask(__name__)
app.secret_key = 'savtex_texas_government_secure_key'

# Flask-Login Setup
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# In-Memory Database for Users (For Production, connect to PostgreSQL / SQLite)
users_db = {}

class User(UserMixin):
    def __init__(self, id, username, email, password_hash, county):
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.county = county  # e.g., "Harris", "Dallas", "Travis", "Bexar"

@login_manager.user_loader
def load_user(user_id):
    return users_db.get(user_id)

NOAA_TEXAS_ALERTS_URL = "https://api.weather.gov/alerts/active?area=TX"

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = next((u for u in users_db.values() if u.email == email), None)
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            flash('Logged in successfully to SAVTEX Command Center.', 'success')
            return redirect(url_for('home'))
        else:
            flash('Invalid email or password. Please try again.', 'danger')
            
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        county = request.form.get('county')

        if any(u.email == email for u in users_db.values()):
            flash('Email address already registered.', 'danger')
            return redirect(url_for('signup'))

        user_id = str(len(users_db) + 1)
        pwd_hash = generate_password_hash(password)
        new_user = User(id=user_id, username=username, email=email, password_hash=pwd_hash, county=county)
        users_db[user_id] = new_user

        login_user(new_user)
        flash('Account created! SAVTEX is now monitoring your local area.', 'success')
        return redirect(url_for('home'))

    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('home'))

@app.route('/alerts')
def alerts():
    return render_template('alerts.html')

@app.route('/prepare')
def prepare():
    return render_template('prepare.html')

@app.route('/contacts')
def contacts():
    return render_template('contacts.html')

@app.route('/api/live-alerts')
def get_live_alerts():
    """Fetches official live NOAA alerts and checks against user's specific location."""
    headers = {'User-Agent': 'SAVTEX-TexasDisasterApp/1.0 (contact@savtex.gov.texas)'}
    try:
        response = requests.get(NOAA_TEXAS_ALERTS_URL, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            user_county = current_user.county if current_user.is_authenticated else None
            
            # Filter severe alerts strictly matching user's region/county
            local_emergency = False
            local_alerts = []

            for feature in data.get('features', []):
                props = feature.get('properties', {})
                area_desc = props.get('areaDesc', '')
                severity = props.get('severity', '')

                # Check if alert applies to user's assigned county
                is_in_user_area = user_county and (user_county.lower() in area_desc.lower())
                is_severe = severity in ['Extreme', 'Severe']

                if is_in_user_area and is_severe:
                    local_emergency = True

                local_alerts.append({
                    'event': props.get('event'),
                    'area': area_desc,
                    'severity': severity,
                    'is_local': is_in_user_area
                })

            return jsonify({
                'features': data.get('features', []),
                'user_county': user_county,
                'local_emergency': local_emergency
            })
        return jsonify({"error": "Failed to fetch live alert data"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)