/**
 * Static fallback templates for HR Documents
 * Ensures reliability when AI services are unavailable.
 */

export const getFallbackTemplate = (type, { name, designation, companyName, joiningDate, ctc, employmentType }) => {
  const currentDate = new Date().toLocaleDateString("en-IN");

  const templates = {
    "Offer Letter": `
      <p style="margin-bottom: 20px;">We are pleased to offer you the position of <strong>${designation}</strong> with <strong>${companyName}</strong>. We are all excited about the potential that you will bring to our organization and look forward to your contributions towards our collective success.</p>
      
      <p style="margin-bottom: 20px;">Your appointment will be effective from your date of joining, which is scheduled for <strong>${joiningDate}</strong>. ${ctc > 0 ? `As discussed, your Total Fixed Cost to Company (CTC) will be <strong>${ctc}</strong> per annum, inclusive of all statutory benefits and allowances.` : "Your compensation and benefits package will be as per the company's standard policy for your grade."}</p>
      
      <p style="margin-bottom: 20px;"><strong>Roles and Responsibilities:</strong> As a ${designation}, your primary responsibilities will include executing key projects, collaborating with cross-functional teams, and upholding the high standards of excellence that ${companyName} is known for. A detailed job description will be provided upon your orientation.</p>
      
      <p style="margin-bottom: 20px;"><strong>Probation Period:</strong> You will be on probation for a period of six months from the date of joining. Upon successful completion of this period, your employment will be confirmed in writing, subject to your performance and conduct meeting our expectations.</p>
      
      <p style="margin-bottom: 20px;"><strong>Confidentiality and Code of Conduct:</strong> During your employment, you will have access to confidential information. You are required to maintain the highest level of confidentiality and adhere to the company's Code of Conduct and all internal policies at all times.</p>
      
      <p style="margin-bottom: 30px;">We look forward to your arrival as an employee of our organization and are confident that you will play a key role in our company's expansion. Please acknowledge your acceptance of this offer by signing and returning a copy of this letter.</p>
    `,
    "Internship Letter": `
      <p style="margin-bottom: 20px;">This is to confirm your selection as an <strong>Intern - ${designation}</strong> with <strong>${companyName}</strong>. We are pleased to welcome you to our internship program, which is designed to provide you with practical industry exposure and professional growth opportunities.</p>
      
      <p style="margin-bottom: 20px;">Your internship is scheduled to commence on <strong>${joiningDate}</strong> and will continue for a duration as specified in your academic requirements or project scope. During this period, you will be reporting to the Department Head or a designated mentor who will guide you through your learning journey.</p>
      
      <p style="margin-bottom: 20px;"><strong>Scope of Work:</strong> You will be involved in various projects and learning objectives within our ${designation} team. This includes assisting in research, participating in team meetings, and contributing to ongoing operational tasks. ${ctc > 0 ? `In recognition of your contributions, you will be eligible for a monthly stipend of INR ${Math.round(ctc / 12)}.` : "This is an unpaid internship focused on providing educational value and skill development."}</p>
      
      <p style="margin-bottom: 20px;"><strong>Confidentiality:</strong> As an intern, you may have access to proprietary information. You are bound by the company's non-disclosure agreement and must ensure that no sensitive data is shared outside the organization.</p>
      
      <p style="margin-bottom: 20px;">Upon successful completion of the internship, you will be provided with a certificate acknowledging your service and performance. We hope this internship provides you with valuable industry experience and helps in your professional growth.</p>
    `,
    "Appraisal Letter": `
      <p style="margin-bottom: 20px;">We are pleased to inform you that your performance during the last review period has been exceptional. In recognition of your hard work, dedication, and significant contributions to the growth of <strong>${companyName}</strong>, your compensation package has been revised.</p>
      
      <p style="margin-bottom: 20px;">Effective from the current pay cycle, your new Total Cost to Company (CTC) will be <strong>${ctc}</strong> per annum. This increment reflects our appreciation for your commitment to excellence and your alignment with the company's core values.</p>
      
      <p style="margin-bottom: 20px;"><strong>Performance Highlights:</strong> Your efforts in streamlining departmental processes and your proactive approach to problem-solving have been particularly noteworthy. We value the positive impact you have had on the team's morale and productivity.</p>
      
      <p style="margin-bottom: 20px;"><strong>Future Expectations:</strong> As we move forward, we expect you to continue demonstrating the same level of passion and leadership. We are committed to providing you with opportunities for further career progression and skill enhancement.</p>
      
      <p style="margin-bottom: 20px;">All other terms and conditions of your employment contract remain unchanged. We thank you for your continued commitment and look forward to your further contributions to our shared success.</p>
    `,
    "Experience Letter": `
      <p style="margin-bottom: 20px;">This is to certify that <strong>${name}</strong> was employed with <strong>${companyName}</strong> as a <strong>${designation}</strong> from <strong>${joiningDate}</strong> to <strong>${currentDate}</strong>.</p>
      
      <p style="margin-bottom: 20px;">During the tenure with our organization, we found ${name} to be an exceptionally hardworking, dedicated, and professional individual. ${name} was responsible for managing key deliverables within the ${designation} domain and consistently met or exceeded performance benchmarks.</p>
      
      <p style="margin-bottom: 20px;"><strong>Key Contributions:</strong> ${name} played a vital role in several successful projects and was known for their collaborative spirit and technical proficiency. Their ability to handle complex tasks with minimal supervision was highly valued by the management and peers alike.</p>
      
      <p style="margin-bottom: 20px;">In addition to their professional competence, ${name} maintained a high standard of conduct and integrity. They were a disciplined team player who contributed positively to the organization's culture and work environment.</p>
      
      <p style="margin-bottom: 20px;">We are confident that ${name} will be a valuable asset to any organization they join in the future. We take this opportunity to thank them for their service and wish them the very best for all their future professional endeavors.</p>
    `,
    "Relieving Letter": `
      <p style="margin-bottom: 20px;">This letter is to confirm that <strong>${name}</strong> has been relieved from the services of <strong>${companyName}</strong> with effect from the close of business hours on <strong>${currentDate}</strong>, following the acceptance of their resignation.</p>
      
      <p style="margin-bottom: 20px;">We confirm that <strong>${name}</strong> has successfully completed the handover process and all company property, including assets, access cards, and documents, have been returned in good condition. Furthermore, all financial dues have been settled as per the full and final settlement process.</p>
      
      <p style="margin-bottom: 20px;">During their time with us as a <strong>${designation}</strong>, ${name} demonstrated a high level of professionalism and dedication to their duties. We appreciate the time and effort they invested in the organization and their contributions towards our projects.</p>
      
      <p style="margin-bottom: 20px;"><strong>No Dues Certificate:</strong> This document also serves as a formal clearance, confirming that there are no outstanding liabilities or obligations between the employee and the company as of the relieving date.</p>
      
      <p style="margin-bottom: 20px;">We wish ${name} success in their future career and personal milestones. This letter is issued as part of our standard exit procedure.</p>
    `
  };

  return templates[type] || `
    <p style="margin-bottom: 20px;">This document is issued to <strong>${name}</strong> regarding their role as <strong>${designation}</strong> at <strong>${companyName}</strong>.</p>
    <p style="margin-bottom: 20px;">At ${companyName}, we value the professional relationship we share with our employees and stakeholders. This communication serves to formalize the recent discussions and agreements pertaining to your association with the organization.</p>
    <p style="margin-bottom: 20px;">Please refer to the attached Annexures and company policy handbooks for detailed terms and conditions. We are committed to maintaining a transparent and supportive environment for all our members.</p>
  `;
};
