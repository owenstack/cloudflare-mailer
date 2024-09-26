import { EmailMessage } from "cloudflare:email";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMimeMessage } from "mimetext";

type Body = {
	senderName: string;
	senderAddress: string;
	recipientAddress: string;
	subject: string;
	body: string;
};

const worker = new Hono();

worker.use("*", (c, next) => {
	const origins =
		c.env.ALLOWED_ORIGINS === "*" ? "*" : c.env.ALLOWED_ORIGINS.split(",");
	const corsMiddleware = cors(origins);
	return corsMiddleware(c, next);
});

worker.post("/send", async (c) => {
	const text = await c.req.text();
	const body: Body = JSON.parse(text);
	if (!body.subject || !body.body) {
		c.status(400);
		return c.json({
			status: "error",
			message: "Missing subject or body",
		});
	}

	const msg = createMimeMessage();
	msg.setSender({ name: body.senderName, addr: body.senderAddress });
	msg.setRecipient(body.recipientAddress);
	msg.setSubject(body.subject);
	msg.addMessage({
		contentType: "text/html",
		data: body.body,
	});

	const message = new EmailMessage(
		body.senderAddress,
		body.recipientAddress,
		msg.asRaw(),
	);

	try {
		await c.env.SEB.send(message);
	} catch (e) {
		c.status(500);
		return c.json({
			status: "error",
			message: "Email failed to send",
			error_details: e.message,
		});
	}

	return c.json({
		status: "success",
		message: "Email sent successfully",
	});
});

export default worker;
