from google import genai

client = genai.Client(api_key="AIzaSyDEIz8oOVPzwweJYEjmUNt1qOouHDdGGSU")

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Say hello in one sentence."
)

print("✅ API key working!")
print(response.text)