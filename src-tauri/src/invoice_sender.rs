use base64::{engine::general_purpose, Engine as _};
use lettre::message::header::ContentType;
use lettre::message::{Attachment, Body, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};

#[tauri::command]
pub fn send_invoice(
    server: &str,
    port: u16,
    username: String,
    password: String,
    from: String,
    to: String,
    subject: String,
    body: String,
    attachment_name: String,
    attachment_mimetype: String,
    attachment: String,
) {
    println!("I was invoked from JavaScript!");

    let email = Message::builder()
        .from(from.parse::<Mailbox>().unwrap())
        .to(to.parse::<Mailbox>().unwrap())
        .subject(subject)
        .multipart(
            MultiPart::mixed()
                .singlepart(SinglePart::plain(body))
                .singlepart(Attachment::new(attachment_name).body(
                    Body::new(general_purpose::STANDARD.decode(attachment).unwrap()),
                    attachment_mimetype.parse::<ContentType>().unwrap(),
                )),
        )
        .unwrap();

    let creds = Credentials::new(username, password);

    let mailer = SmtpTransport::starttls_relay(server)
        .unwrap() // Unwrap the Result, panics in case of error
        .port(port)
        .credentials(creds) // Provide the credentials to the transport
        .build(); // Construct the transport

    // Attempt to send the email via the SMTP transport
    match mailer.send(&email) {
        // If email was sent successfully, print confirmation message
        Ok(_) => println!("Email sent successfully!"),
        // If there was an error sending the email, print the error
        Err(e) => eprintln!("Could not send email: {:?}", e),
    }
}
