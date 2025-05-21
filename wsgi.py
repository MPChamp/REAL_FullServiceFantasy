# wsgi.py
from app import app  # Assuming your main Flask file is app.py and instance is 'app'

if __name__ == "__main__":
    # This part is for local testing of this wsgi file,
    # Vercel/Gunicorn won't use app.run()
    app.run()
