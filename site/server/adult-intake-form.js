// Transcribed from the adult intake PDF; served only within an owned booking flow.
export const adultIntakeForm = `
<form id="intake-form" novalidate>
<p>The following information will be held in strict confidence. To help us be effective in working together, please be as specific as possible. Thank you.</p>
<div class="step-progress" aria-hidden="true">
<span>
<i>
</i>
</span>
<span>
<i>
</i>
</span>
<span>
<i>
</i>
</span>
<span>
<i>
</i>
</span>
<span>
<i>
</i>
</span>
</div>
<fieldset class="form-step">
<legend>1. Your details</legend>
<div class="field">
<label for="clientName">Name</label>
<input id="clientName" name="clientName" type="text" maxlength="200" required>
</div>
<div class="field">
<label for="birthDate">Birth date</label>
<input id="birthDate" name="birthDate" type="date" maxlength="200" required>
</div>
<div class="field">
<label for="address">Address</label>
<input id="address" name="address" type="text" maxlength="200" required>
</div>
<div class="field">
<label for="city">City</label>
<input id="city" name="city" type="text" maxlength="200" required>
</div>
<div class="field">
<label for="province">Province / State</label>
<input id="province" name="province" type="text" maxlength="200" required>
</div>
<div class="field">
<label for="postalCode">Postal / ZIP code</label>
<input id="postalCode" name="postalCode" type="text" maxlength="200" required>
</div>
<div class="field">
<label for="email">Email</label>
<input id="email" name="email" type="email" maxlength="200" required>
</div>
<div class="field">
<label for="occupation">Occupation / Employer</label>
<input id="occupation" name="occupation" type="text" maxlength="200">
</div>
<div class="field">
<label for="homePhone">Home phone</label>
<input id="homePhone" name="homePhone" type="tel" maxlength="200">
</div>
<div class="field">
<label for="cellPhone">Cell phone</label>
<input id="cellPhone" name="cellPhone" type="tel" maxlength="200">
</div>
<div class="field">
<label for="workPhone">Work phone</label>
<input id="workPhone" name="workPhone" type="tel" maxlength="200">
</div>
<div class="field">
<label for="referredBy">Referred by</label>
<input id="referredBy" name="referredBy" type="text" maxlength="200">
</div>
<div class="field">
<label for="preferredPhone">Preferred phone for us to call first</label>
<select id="preferredPhone" name="preferredPhone" required>
<option value="">Choose a phone</option>
<option value="home">Home</option>
<option value="cell">Cell</option>
<option value="work">Work</option>
</select>
</div>
</fieldset>
<fieldset class="form-step">
<legend>2. Health history</legend>
<div class="field">
<label for="reason">What is bothering you at this time?</label>
<textarea id="reason" name="reason" maxlength="4000" required>
</textarea>
</div>
<div class="field">
<label for="surgicalHistory">Please describe any surgery, accident, or muscular/ skeletal problem or pain that has required medical attention?</label>
<textarea id="surgicalHistory" name="surgicalHistory" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="supportDevices">Please describe any physical aides you use such as walker, wheelchair, etc.</label>
<textarea id="supportDevices" name="supportDevices" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="medications">Please list any medications that you currently take:</label>
<textarea id="medications" name="medications" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="mentalHealth">Please describe any mental health concerns/issues you are dealing with/have been diagnosed with:</label>
<textarea id="mentalHealth" name="mentalHealth" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="handDominance">Hand dominance</label>
<select name="handDominance" id="handDominance">
<option value="">Choose if applicable</option>
<option value="right">Right</option>
<option value="left">Left</option>
</select>
</div>
</fieldset>
<fieldset class="form-step">
<legend>3. Areas of concern</legend>
<div class="field">
<label for="neck">Neck</label>
<textarea id="neck" name="neck" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="arms">Arms/Wrists/Hands, R or L</label>
<textarea id="arms" name="arms" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="back">Back (Upper/Middle/Lower)</label>
<textarea id="back" name="back" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="shoulders">Shoulders</label>
<textarea id="shoulders" name="shoulders" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="hips">Hips (R or L)</label>
<textarea id="hips" name="hips" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="legs">Legs (R or L)</label>
<textarea id="legs" name="legs" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="knees">Knees (R or L)</label>
<textarea id="knees" name="knees" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="anklesFeet">Ankles/Feet (R or L)</label>
<textarea id="anklesFeet" name="anklesFeet" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="otherAreas">Other</label>
<textarea id="otherAreas" name="otherAreas" maxlength="4000">
</textarea>
</div>
</fieldset>
<fieldset class="form-step">
<legend>4. Medical history</legend>
<p>Please check any of the following that apply to you:</p>
<div class="grid grid-2">
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Allergies/Asthma/Sinus"> Allergies/Asthma/Sinus</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Athletes Foot"> Athletes Foot</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Arthritis"> Arthritis</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Autoimmune Disorder"> Autoimmune Disorder</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Blood Clots"> Blood Clots</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Bone/Joint Disease"> Bone/Joint Disease</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Cancer"> Cancer</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Cardiovascular/Heart"> Cardiovascular/Heart</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Chronic Pain"> Chronic Pain</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Constipation"> Constipation</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Dentures"> Dentures</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Diabetes"> Diabetes</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Digestive"> Digestive</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Dizziness"> Dizziness</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Headaches"> Headaches</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="High/Low Blood Pressure"> High/Low Blood Pressure</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Mastectomy: Right"> Mastectomy: Right</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Mastectomy: Left"> Mastectomy: Left</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Numbness/Tingling"> Numbness/Tingling</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Pacemaker"> Pacemaker</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Phlebitis"> Phlebitis</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="PMS"> PMS</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Pregnant"> Pregnant</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Respiratory/Lungs"> Respiratory/Lungs</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Sciatica"> Sciatica</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Scoliosis"> Scoliosis</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Skin Disorders"> Skin Disorders</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="TMJ/Jaw Pain"> TMJ/Jaw Pain</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Varicose Veins"> Varicose Veins</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Vision: Contacts"> Vision: Contacts</label>
</div>
<div class="field">
<label>
<input type="checkbox" name="conditions" value="Vision: Glasses"> Vision: Glasses</label>
</div>
</div>
<div class="field">
<label for="pregnancyDue">Pregnant: Due</label>
<input id="pregnancyDue" name="pregnancyDue" type="text" maxlength="200">
</div>
<div class="field">
<label for="otherConditions">Other medical conditions (specify)</label>
<textarea id="otherConditions" name="otherConditions" maxlength="4000">
</textarea>
</div>
<div class="field">
<label for="additionalInfo">Any other concerns</label>
<textarea id="additionalInfo" name="additionalInfo" maxlength="4000">
</textarea>
</div>
</fieldset>
<fieldset class="form-step">
<legend>5. Release of liability</legend>
<p>Please initial the following and sign below:</p>
<div class="field">
<label for="educationInitials">I understand that the lessons given by Heidi Rood (hereafter the “Practitioner”) are a way to open doors to new possibilities of movement and are educational only. They are not medical and do not take the place of appropriate medical care. (Initials)</label>
<input id="educationInitials" name="educationInitials" type="text" maxlength="200" required>
</div>
<div class="field">
<label for="discomfortInitials">I agree to let the Practitioner know immediately if I experience any discomfort or increased discomfort. (Initials)</label>
<input id="discomfortInitials" name="discomfortInitials" type="text" maxlength="200" required>
</div>
<div class="field">
<label for="healthInitials">I affirm that I have notified the Practitioner of all known medical conditions and injuries and will inform her of any changes in my health and medical condition. (Initials)</label>
<input id="healthInitials" name="healthInitials" type="text" maxlength="200" required>
</div>
<div class="field">
<label for="cancellationInitials">I understand that I am responsible for giving at least 24hr notice for any cancellation; otherwise, I am still responsible for payment for the missed lesson. (Initials)</label>
<input id="cancellationInitials" name="cancellationInitials" type="text" maxlength="200" required>
</div>
<p>In exchange for the ability to participate in these lessons,</p>
<div class="field">
<label for="releasorName">Releasor (fill in your name here)</label>
<input id="releasorName" name="releasorName" type="text" maxlength="200" required>
</div>
<p>(“Releasor”), does hereby remise, release, and forever discharge Heidi Rood, as well as her agents, from all manner of actions, suits, proceedings, judgments, damages, claims, and demands in law or equity, which Releasor has or may have as a result of lessons or other services, supplies or instructions provided by or on behalf Heidi Rood.</p>
<p>In witness whereof, I have signed this Intake Form and Release of Liability this day of</p>
<div class="field">
<label for="signDate">Date</label>
<input id="signDate" name="signDate" type="date" maxlength="200" required>
</div>
<div class="field">
<label for="signature">Signature of Releasor (type full legal name)</label>
<input id="signature" name="signature" type="text" maxlength="200" required>
</div>
</fieldset>
<div class="step-nav">
<button type="button" class="btn btn-ghost" id="intake-back">Back</button>
<button type="button" class="btn btn-primary" id="intake-next">Continue</button>
<button type="submit" class="btn btn-primary" id="intake-submit" style="display:none">Submit intake form</button>
</div>
</form>
`;
